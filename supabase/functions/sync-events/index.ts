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
    const { spreadsheetId } = await req.json()
    if (!spreadsheetId) {
      throw new Error('Missing spreadsheetId in request body')
    }

    console.log('Starting sync process...')
    console.log('Getting access token...')
    const accessToken = await getAccessToken()

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

    console.log(`Inserting ${events.length} events...`)
    console.log('Sample event:', JSON.stringify(events[0], null, 2))
    const { error: insertError } = await supabase
      .from('events')
      .insert(events.map(event => ({
        date: event.date,
        title: event.title,
        status: event.status || 'pending',
        is_recurring: event.is_recurring,
        room: event.room,
        promoter: event.promoter,
        capacity: event.capacity,
        _sheet_line_number: event._sheet_line_number
      })))

    if (insertError) {
      console.error('Error inserting events:', insertError)
      throw new Error(`Failed to insert events: ${insertError.message}`)
    }

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