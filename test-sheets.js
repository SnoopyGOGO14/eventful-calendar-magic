const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  try {
    const credentials = JSON.parse(fs.readFileSync('/Users/lfi/Downloads/studio-338-calendar-2dbc45a73c2f.json', 'utf8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('Attempting to fetch spreadsheet...');
    const response = await sheets.spreadsheets.get({
      spreadsheetId: '10Hj8OsJemFkmRbu-EGGOBnFUKAh8FMhPWsvjuSl6okw'
    });
    
    console.log('Spreadsheet details:', response.data.properties);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response error:', error.response.data);
    }
  }
}

main();
