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
    console.log('Starting events sync...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { spreadsheetId } = await req.json()
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required')
    }

    const credentialsStr = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS')
    if (!credentialsStr) {
      throw new Error('Google Sheets credentials not found')
    }

    const credentials = JSON.parse(credentialsStr)
    const accessToken = await getAccessToken(credentials)

    console.log('Fetching data from sheet...')
    const { values, formatting } = await fetchSheetData(spreadsheetId, accessToken)
    console.log(`Found ${values.length} rows in sheet`)

    const events = parseSheetRows(values, formatting)

    // Log events before inserting into database
    console.log('Events to insert:', events);

    // Delete all existing events
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', 0); // Delete all rows

    if (deleteError) {
      console.error('Error deleting existing events:', deleteError);
      throw new Error('Failed to delete existing events');
    }

    // Insert new events
    const { error: insertError } = await supabase
      .from('events')
      .insert(events.map(event => ({
        date: event.date,
        title: event.title,
        status: event.status || 'pending', // Default to pending if no status
        is_recurring: event.is_recurring,
        room: event.room,
        promoter: event.promoter,
        capacity: event.capacity,
        _sheet_line_number: event._sheet_line_number
      })));

    if (insertError) {
      console.error('Error inserting events:', insertError);
      throw new Error('Failed to insert events');
    }

    console.log('Events sync completed successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: 'Events synced successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error syncing events:', error)
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