import { EventStatus, SPREADSHEET_CELL_COLORS } from './types.ts';

// Types for API responses
interface SheetData {
  values: string[][];
  formatting: any[];
}

interface Event {
  date: string;
  title: string;
  status: EventStatus;
  room?: string;
  promoter?: string;
  capacity?: string;
  _sheet_line_number: number;
  is_recurring: boolean;
}

export async function fetchSheetData(spreadsheetId: string, accessToken: string): Promise<SheetData> {
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
  
  // Extract formatting array from response
  const formattingArray = formatting?.sheets?.[0]?.data?.[0]?.rowData || [];
  
  return {
    values: values.values || [],
    formatting: formattingArray
  };
}

function getRowBackgroundColor(rowFormatting: any) {
  console.log('Row formatting:', JSON.stringify(rowFormatting));
  
  if (!rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor) {
    console.log('No background color found for row');
    return null;
  }
  
  const bgColor = rowFormatting.values[0].userEnteredFormat.backgroundColor;
  console.log('Background color found:', bgColor);
  
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log('Skipping white cell');
    return null;
  }

  return bgColor;
}

function determineStatusFromColor(rowFormatting: any): EventStatus {
  const bgColor = getRowBackgroundColor(rowFormatting);
  if (!bgColor) {
    console.log('No background color, defaulting to pending');
    return 'pending';
  }
  
  // Convert to RGB string format
  const rgb = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  console.log('Converted RGB:', rgb);
  console.log('Available color mappings:', SPREADSHEET_CELL_COLORS);
  
  const status = SPREADSHEET_CELL_COLORS[rgb] || 'pending';
  console.log('Determined status:', status);
  return status;
}

export function parseSheetRows(values: string[][], formatting: any[] = []): Event[] {
  console.log('Starting to parse sheet rows...');
  console.log(`Number of rows: ${values?.length || 0}`);
  console.log(`Number of formatting rows: ${formatting?.length || 0}`);

  if (!values?.length) {
    console.log('No values found in sheet');
    return [];
  }

  return values.slice(1).map((row, index) => {  // Skip header row
    if (!row || row.length < 1) {
      console.log(`Skipping empty row at index ${index + 1}`);
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    if (!date || !title) {
      console.log(`Skipping invalid row at index ${index + 1}: missing date or title`);
      return null;
    }
    
    // Get formatting for this row, default to pending if not found
    const rowFormatting = formatting[index + 1];  // Add 1 to account for header
    const status = determineStatusFromColor(rowFormatting);
    console.log(`Row ${index + 2}: date=${date}, title=${title}, status=${status}`);

    return {
      date: formatDate(date.trim()),
      title: title.trim(),
      status,
      room: room?.trim() || '',
      promoter: promoter?.trim() || '',
      capacity: capacity?.trim() || '',
      _sheet_line_number: index + 2,  // Add 2 to show actual sheet line number
      is_recurring: false
    };
  }).filter((row): row is Event => row !== null);
}
