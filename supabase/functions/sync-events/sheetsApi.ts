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
  if (!rowFormatting?.values) {
    console.log('No row formatting values found');
    return null;
  }
  
  // Look specifically at column G (index 5 since we start from B)
  const columnGFormatting = rowFormatting.values[5];
  if (!columnGFormatting?.userEnteredFormat?.backgroundColor) {
    console.log('No background color in column G');
    return null;
  }

  const bgColor = columnGFormatting.userEnteredFormat.backgroundColor;
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log('Skipping white cell in column G');
    return null;
  }

  return bgColor;
}

function determineStatusFromColor(rowFormatting: any): EventStatus | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  if (!bgColor) return null;
  
  // Convert to RGB string format
  const rgb = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  return SPREADSHEET_CELL_COLORS[rgb] || null;
}

function parseSheetRows(values: string[][], formatting: any[]) {
  return values.map((row, index) => {
    const [date, title, room, promoter, capacity] = row;
    if (!date || !title || date === 'DATE') return null;
    
    const status = determineStatusFromColor(formatting[index]);
    if (!status) return null;

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