import { createClient } from '@supabase/supabase-js';
import { google } from 'https://googleapis.deno.dev/v118/sheets/v4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
};

// Initialize Google Sheets API client
const initGoogleSheets = async () => {
  try {
    const credentials = JSON.parse(Deno.env.get('GOOGLE_SHEETS_CREDENTIALS') || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error initializing Google Sheets:', error);
    throw error;
  }
};

// Initialize Supabase client
const initSupabase = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Main function to handle the request
Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Starting events sync...');
    
    // Initialize clients
    const sheets = await initGoogleSheets();
    const supabase = initSupabase();

    // Get the spreadsheet ID from the request body
    const { spreadsheetId } = await req.json();
    
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required');
    }

    console.log(`Using spreadsheet ID: ${spreadsheetId}`);
    
    // Fetch data from Google Sheets
    const range = 'Sheet1!A2:D'; // Assumes headers in row 1, data starts row 2
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    const rows = response.data.values || [];
    console.log(`Found ${rows.length} rows in Google Sheets`);

    // Process each row and prepare for Supabase
    const events = rows.map(row => ({
      date: row[0], // Date
      title: row[1], // Title
      status: row[2], // Status
      is_recurring: row[3]?.toLowerCase() === 'true', // Is Recurring
    }));

    // Clear existing events and insert new ones
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      throw new Error(`Error deleting existing events: ${deleteError.message}`);
    }

    const { error: insertError } = await supabase
      .from('events')
      .insert(events);

    if (insertError) {
      throw new Error(`Error inserting new events: ${insertError.message}`);
    }

    console.log('Sync completed successfully');
    
    return new Response(
      JSON.stringify({ success: true, message: 'Events synced successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error syncing events:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});