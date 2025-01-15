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
    const events = parseSheetRows(values, formatting)
    console.log(`Found ${events.length} valid events`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client initialized')

    // Clear existing events before inserting new ones
    console.log('Clearing existing events...')
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all events

    if (deleteError) {
      console.error('Error clearing existing events:', deleteError)
      console.error('Error details:', deleteError.details)
      console.error('Error hint:', deleteError.hint)
      console.error('Error code:', deleteError.code)
      throw new Error(`Failed to clear existing events: ${deleteError.message}`)
    }

    // Wait a moment to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log(`Inserting ${events.length} events...`)
    const { error: insertError, data: insertedData } = await supabase
      .from('events')
      .insert(events.map(event => ({
        date: event.date,
        title: event.title,
        status: event.status,
        is_recurring: event.is_recurring,
        room: event.room || null,
        promoter: event.promoter || null,
        capacity: event.capacity || null,
        _sheet_line_number: event._sheet_line_number
      })))
      .select()

    if (insertError) {
      console.error('Error inserting events:', insertError)
      console.error('Error details:', insertError.details)
      console.error('Error hint:', insertError.hint)
      console.error('Error code:', insertError.code)
      throw new Error(`Failed to insert events: ${insertError.message}`)
    }

    console.log('Successfully inserted new events:', {
      count: insertedData?.length || 0,
      firstEvent: insertedData?.[0],
      lastEvent: insertedData?.[insertedData.length - 1]
    })

    console.log('Successfully inserted new events')
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Events synced successfully',
        eventCount: events.length
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