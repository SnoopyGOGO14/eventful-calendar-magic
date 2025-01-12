import { EventStatus, SPREADSHEET_CELL_COLORS } from '../../src/types/eventStatus';

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data...');
  
  // Fetch all relevant columns (B through G)
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:G`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!valuesResponse.ok) {
    const errorText = await valuesResponse.text();
    console.error(`Google Sheets API error fetching values: ${errorText}`);
    throw new Error(`Google Sheets API error: ${errorText}`);
  }

  // Fetch background color formatting for column G only
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!G:G&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!formattingResponse.ok) {
    const errorText = await formattingResponse.text();
    console.error(`Google Sheets API formatting error: ${errorText}`);
    throw new Error(`Google Sheets API formatting error: ${errorText}`);
  }

  const values = await valuesResponse.json();
  const formatting = await formattingResponse.json();
  
  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function getRowBackgroundColor(rowFormatting: any) {
  if (!rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor) {
    console.log('No background color found for row');
    return null;
  }
  
  const bgColor = rowFormatting.values[0].userEnteredFormat.backgroundColor;
  
  // Skip white cells
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log('Skipping white cell');
    return null;
  }

  return bgColor;
}

function determineStatusFromColor(rowFormatting: any): EventStatus | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  if (!bgColor) return 'pending'; // Default to pending if no color is found
  
  // Convert to RGB string format
  const rgb = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  return SPREADSHEET_CELL_COLORS[rgb] || 'pending';
}

function parseSheetRows(values: string[][], formatting: any[]) {
  console.log('Starting to parse sheet rows...');
  console.log(`Number of rows: ${values?.length || 0}`);
  console.log(`Number of formatting rows: ${formatting?.length || 0}`);

  if (!Array.isArray(values) || !Array.isArray(formatting)) {
    console.error('Invalid input: values or formatting is not an array');
    return [];
  }

  return values.map((row, index) => {
    if (!row || row.length < 1) {
      console.log(`Skipping empty row at index ${index}`);
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    
    // Skip header row or rows without required fields
    if (!date || !title || date === 'DATE' || title === 'TITLE') {
      console.log(`Skipping invalid row at index ${index}: missing date or title`);
      return null;
    }

    // Get formatting for this row, default to pending if not found
    const rowFormatting = formatting[index];
    const status = determineStatusFromColor(rowFormatting);

    console.log(`Processing row ${index}:`, { date, title, status });

    return {
      date,
      title,
      status,
      room: room || '',
      promoter: promoter || '',
      capacity: capacity || '',
      _sheet_line_number: index + 1,
      is_recurring: false
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
}

export { parseSheetRows };