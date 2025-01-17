import { Event } from './types.ts';

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  try {
    // Format the sheet name properly for the Google Sheets API
    const sheetName = '338 Cal Copy';
    // Encode the sheet name and construct the range using proper A1 notation
    const encodedRange = `'${sheetName.replace(/'/g, "\\'")}'!A:F`;
    
    console.log('Using range:', encodedRange);
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(encodedRange)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Google Sheets API error response:', errorData);
      throw new Error(`Google Sheets API error: ${errorData}`);
    }

    const data = await response.json();
    console.log('Successfully fetched sheet data');
    
    // Get formatting information using the same range format
    const formattingResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(encodedRange)}&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!formattingResponse.ok) {
      const errorData = await formattingResponse.text();
      console.error('Error fetching formatting:', errorData);
      throw new Error(`Failed to fetch formatting: ${errorData}`);
    }

    const formattingData = await formattingResponse.json();
    console.log('Successfully fetched formatting data');

    return {
      values: data.values || [],
      formatting: formattingData.sheets?.[0]?.data?.[0]?.rowData || []
    };
  } catch (error) {
    console.error('Error in fetchSheetData:', error);
    throw error;
  }
}

export function parseSheetRows(values: any[][], formatting: any[]): Event[] {
  if (!values || values.length === 0) {
    console.log('No values found in sheet');
    return [];
  }

  // Skip header row
  const dataRows = values.slice(1);
  const events: Event[] = [];

  dataRows.forEach((row, index) => {
    if (!row[0] || !row[1]) {
      console.log(`Skipping invalid row at index ${index + 1}`);
      return;
    }

    try {
      const rowFormatting = formatting[index + 1]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      let status: 'confirmed' | 'pending' | 'cancelled' = 'pending';

      // Determine status based on cell color
      if (rowFormatting) {
        if (rowFormatting.red === 1 && rowFormatting.green === 0 && rowFormatting.blue === 0) {
          status = 'cancelled';
        } else if (rowFormatting.green === 1 && rowFormatting.red === 0 && rowFormatting.blue === 0) {
          status = 'confirmed';
        }
      }

      const event: Event = {
        date: row[0],
        title: row[1],
        status,
        isRecurring: row[2]?.toLowerCase() === 'yes',
        room: row[3] || '',
        promoter: row[4] || '',
        capacity: row[5] || '',
        _sheet_line_number: index + 2 // Add 2 to account for 0-based index and header row
      };

      events.push(event);
    } catch (error) {
      console.error(`Error parsing row ${index + 1}:`, error);
    }
  });

  console.log(`Successfully parsed ${events.length} events`);
  return events;
}