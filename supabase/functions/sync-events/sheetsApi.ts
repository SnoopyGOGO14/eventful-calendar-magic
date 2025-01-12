// Types for event status
type EventStatus = 'confirmed' | 'pending' | 'cancelled';

// Single source of truth for spreadsheet colors
const SPREADSHEET_CELL_COLORS: Record<string, EventStatus> = {
  // Cell color -> Status word
  'rgb(67,160,71)': 'confirmed',    // Google Sheets green
  'rgb(255,217,102)': 'pending',    // Google Sheets yellow
  'rgb(244,67,54)': 'cancelled'     // Google Sheets red
};

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data...');
  
  // Fetch all relevant columns (B through F)
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:F`,
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
  if (!rowFormatting?.values) {
    console.log('No row formatting values found');
    return null;
  }
  
  // Look specifically at column G (index 0 since we only fetched G)
  const columnGFormatting = rowFormatting.values[0];
  if (!columnGFormatting?.userEnteredFormat?.backgroundColor) {
    console.log('No background color in column G');
    return null;
  }

  const bgColor = columnGFormatting.userEnteredFormat.backgroundColor;
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log('Skipping white cell in column G');
    return null;
  }

  console.log('Found background color in column G:', bgColor);
  return bgColor;
}

function determineStatusFromColor(rowFormatting: any): EventStatus | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  if (!bgColor) return 'pending';  // Default to pending if no color found
  
  // Convert to RGB string format
  const rgb = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  return SPREADSHEET_CELL_COLORS[rgb] || 'pending';
}

export function parseSheetRows(values: string[][], formatting: any[] = []) {
  console.log('Starting to parse sheet rows...');
  console.log(`Number of rows: ${values?.length || 0}`);
  console.log(`Number of formatting rows: ${formatting?.length || 0}`);
  
  if (!values || !Array.isArray(values)) {
    console.log('No valid rows found in sheet data');
    return [];
  }

  return values.map((row, index) => {
    if (!row || row.length < 1) {
      console.log(`Skipping empty row at index ${index}`);
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    if (!date || !title || date === 'DATE') {
      console.log(`Skipping invalid row at index ${index}: missing date or title`);
      return null;
    }
    
    // Get formatting for this row, default to pending if not found
    const rowFormatting = formatting[index];
    const status = rowFormatting ? determineStatusFromColor(rowFormatting) : 'pending';
    console.log(`Row ${index + 1}: date=${date}, title=${title}, status=${status}`);

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