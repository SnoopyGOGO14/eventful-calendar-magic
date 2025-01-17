#!/bin/bash

# Your spreadsheet ID from the Apps Script
SPREADSHEET_ID="18KbXdfe2EfjtP3YahNRs1uJauMoK0yZsJCwzeCBu1kc"

# Call the sync-events function
curl -i -X POST \
  'https://rfssrfninhlzcgqdejdb.supabase.co/functions/v1/sync-events' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  -H 'Content-Type: application/json' \
  -d "{\"spreadsheetId\": \"$SPREADSHEET_ID\"}"