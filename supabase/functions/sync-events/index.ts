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
    console.log('Starting events sync for 2025...')
    
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

    console.log('Fetching data from 2025 tab...')
    const { values, formatting } = await fetchSheetData(spreadsheetId, accessToken)
    console.log(`Found ${values.length} rows in 2025 tab`)

    const events = parseSheetRows(values, formatting)

    console.log('Clearing existing 2025 events...')
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .gte('date', '2025-01-01')
      .lt('date', '2026-01-01')

    if (deleteError) {
      throw new Error(`Error deleting existing events: ${deleteError.message}`)
    }

    console.log('Inserting new events...')
    const { error: insertError } = await supabase
      .from('events')
      .insert(events)

    if (insertError) {
      throw new Error(`Error inserting new events: ${insertError.message}`)
    }

    console.log('2025 events sync completed successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: '2025 events synced successfully' }),
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