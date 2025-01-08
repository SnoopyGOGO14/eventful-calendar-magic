import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

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
  const credentials = JSON.parse(Deno.env.get('GOOGLE_SHEETS_CREDENTIALS') || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
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
    
    // Replace with your actual spreadsheet ID and range
    const spreadsheetId = '1234567890'; // You'll need to provide this
    const range = 'Sheet1!A2:E'; // Adjust based on your sheet structure
    
    // Fetch data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    const rows = response.data.values || [];
    console.log(`Found ${rows.length} rows in Google Sheets`);

    // Process each row and prepare for Supabase
    const events = rows.map(row => ({
      date: row[0], // Assuming first column is date
      title: row[1], // Assuming second column is title
      status: row[2], // Assuming third column is status
      is_recurring: row[3] === 'true', // Assuming fourth column is is_recurring
    }));

    // Clear existing events and insert new ones
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

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