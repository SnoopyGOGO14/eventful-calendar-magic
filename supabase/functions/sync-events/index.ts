import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
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
    console.log('=== Starting events sync ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    console.log('Supabase URL:', supabaseUrl)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { spreadsheetId } = await req.json()
    console.log('Spreadsheet ID:', spreadsheetId)
    
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required')
    }

    const credentialsStr = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS')
    if (!credentialsStr) {
      throw new Error('Google Sheets credentials not found')
    }

    console.log('Getting Google Sheets access token...')
    const credentials = JSON.parse(credentialsStr)
    const accessToken = await getAccessToken(credentials)
    console.log('Successfully got access token')

    console.log('Fetching data from sheet...')
    const { values } = await fetchSheetData(spreadsheetId, accessToken)
    console.log(`Found ${values?.length || 0} rows in sheet`)

    console.log('Parsing sheet rows...')
    const events = parseSheetRows(values)
    console.log(`Parsed ${events.length} valid events`)
    console.log('First few events:', events.slice(0, 3))

    console.log('=== Starting database operations ===')
    
    // First check current events
    const { data: currentEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, date, title')
    
    if (fetchError) {
      console.error('Error fetching current events:', fetchError)
      throw new Error('Failed to fetch current events')
    }
    
    console.log(`Found ${currentEvents?.length || 0} existing events in database`)

    console.log('Clearing existing events...')
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .not('id', 'is', null)  // Delete all events, no special handling for test data

    if (deleteError) {
      console.error('Error deleting events:', deleteError)
      throw new Error('Failed to delete events')
    }
    console.log('Successfully cleared existing events')

    if (events.length === 0) {
      console.log('No events to insert, finishing sync')
      return new Response(
        JSON.stringify({ success: true, message: 'No events to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Inserting ${events.length} events...`)
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
      throw new Error('Failed to insert events')
    }

    console.log('Successfully inserted new events')

    // Verify the insert
    const { data: verifyEvents, error: verifyError } = await supabase
      .from('events')
      .select('id, date, title, status')
      .order('date', { ascending: true })
    
    if (verifyError) {
      console.error('Error verifying events:', verifyError)
    } else {
      console.log(`Verified ${verifyEvents?.length || 0} events in database`)
      console.log('First few events in DB:', verifyEvents?.slice(0, 3))
    }

    console.log('=== Events sync completed successfully ===')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Events synced successfully',
        eventCount: events.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('=== Error syncing events ===')
    console.error(error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})