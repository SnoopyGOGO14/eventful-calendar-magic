import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAccessToken } from './googleAuth.ts'
import { fetchSheetData, parseSheetRows } from './sheetsApi.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting sync process...')
    const { spreadsheetId } = await req.json()
    if (!spreadsheetId) {
      throw new Error('Missing spreadsheetId in request body')
    }

    console.log('Getting access token...')
    const accessToken = await getAccessToken()
    if (!accessToken) {
      throw new Error('Failed to get access token')
    }

    console.log('Fetching sheet data...')
    const { values, formatting } = await fetchSheetData(spreadsheetId, accessToken)

    console.log('Parsing rows...')
    const newEvents = parseSheetRows(values, formatting)
    console.log(`Found ${newEvents.length} valid events`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client initialized')

    // Get existing events
    const { data: existingEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, _sheet_line_number')
    
    if (fetchError) {
      throw new Error(`Failed to fetch existing events: ${fetchError.message}`)
    }

    // Create a map of existing events by line number
    const existingEventMap = new Map(
      existingEvents?.map(event => [event._sheet_line_number, event.id]) || []
    )

    // Prepare batch operations
    const toUpdate = []
    const toInsert = []
    const seenLineNumbers = new Set()

    // Sort events into updates and inserts
    for (const event of newEvents) {
      const lineNumber = event._sheet_line_number
      seenLineNumbers.add(lineNumber)

      if (existingEventMap.has(lineNumber)) {
        toUpdate.push({
          ...event,
          id: existingEventMap.get(lineNumber)
        })
      } else {
        toInsert.push(event)
      }
    }

    // Find events to delete (those not in the new data)
    const toDelete = existingEvents
      ?.filter(event => !seenLineNumbers.has(event._sheet_line_number))
      .map(event => event.id) || []

    console.log(`Processing: ${toUpdate.length} updates, ${toInsert.length} inserts, ${toDelete.length} deletes`)

    // Perform updates
    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('events')
        .upsert(toUpdate)

      if (updateError) {
        console.error('Error updating events:', updateError)
        throw new Error(`Failed to update events: ${updateError.message}`)
      }
    }

    // Perform inserts
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('events')
        .insert(toInsert)

      if (insertError) {
        console.error('Error inserting events:', insertError)
        throw new Error(`Failed to insert events: ${insertError.message}`)
      }
    }

    // Perform deletes
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', toDelete)

      if (deleteError) {
        console.error('Error deleting events:', deleteError)
        throw new Error(`Failed to delete events: ${deleteError.message}`)
      }
    }

    console.log('Sync completed successfully')
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Events synced successfully',
        stats: {
          updated: toUpdate.length,
          inserted: toInsert.length,
          deleted: toDelete.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in sync process:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})