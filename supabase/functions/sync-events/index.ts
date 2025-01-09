import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting events sync...')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the spreadsheet ID from the request body
    const { spreadsheetId } = await req.json()
    
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required')
    }

    console.log(`Using spreadsheet ID: ${spreadsheetId}`)

    // Get and parse Google Sheets credentials
    const credentialsStr = Deno.env.get('Google sheets Json')
    if (!credentialsStr) {
      console.error('Google Sheets credentials not found')
      throw new Error('Google Sheets credentials not found')
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsStr)
      console.log('Successfully parsed Google credentials')
    } catch (error) {
      console.error('Error parsing Google credentials:', error)
      throw new Error('Invalid Google Sheets credentials format')
    }

    // Make a direct fetch request to Google Sheets API
    console.log('Fetching data from Google Sheets...')
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:D`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Sheets API error:', errorText)
      throw new Error(`Google Sheets API error: ${errorText}`)
    }

    const data = await response.json()
    const rows = data.values || []
    console.log(`Found ${rows.length} rows in Google Sheets`)

    // Process each row and prepare for Supabase
    const events = rows.map(row => ({
      date: row[0], // Date
      title: row[1], // Title
      status: row[2]?.toLowerCase() || 'pending', // Status
      is_recurring: row[3]?.toLowerCase() === 'true', // Is Recurring
    }))

    // Clear existing events and insert new ones
    console.log('Clearing existing events...')
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      console.error('Error deleting existing events:', deleteError)
      throw new Error(`Error deleting existing events: ${deleteError.message}`)
    }

    console.log('Inserting new events...')
    const { error: insertError } = await supabase
      .from('events')
      .insert(events)

    if (insertError) {
      console.error('Error inserting new events:', insertError)
      throw new Error(`Error inserting new events: ${insertError.message}`)
    }

    console.log('Sync completed successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: 'Events synced successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error syncing events:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})