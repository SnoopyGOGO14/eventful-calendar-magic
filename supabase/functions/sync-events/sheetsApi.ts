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
  if (!rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor) {
    console.log('No background color found for row');
    return null;
  }
  
  const bgColor = rowFormatting.values[0].userEnteredFormat.backgroundColor;
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log('Skipping white cell');
    return null;
  }

  return bgColor;
}

function determineStatusFromColor(rowFormatting: any): EventStatus {
  const bgColor = getRowBackgroundColor(rowFormatting);
  if (!bgColor) return 'pending';  // Default to pending if no color found
  
  // Convert to RGB string format
  const rgb = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  return SPREADSHEET_CELL_COLORS[rgb] || 'pending';
}

function formatDate(dateStr: string): string {
  // Convert various date formats to "2025-01-04"
  const months: { [key: string]: string } = {
    'January': '01', 'Janaury': '01',  // Handle common misspelling
    'February': '02', 'Febuary': '02',  // Handle common misspelling
    'March': '03',
    'April': '04',
    'May': '05',
    'June': '06',
    'July': '07',
    'August': '08',
    'September': '09',
    'October': '10',
    'November': '11',
    'December': '12'
  };

  const parts = dateStr.split(' ');
  
  // Find the month part and day part
  let monthPart = '';
  let dayPart = '';
  for (const part of parts) {
    // Check for month
    if (months[part]) {
      monthPart = part;
      continue;
    }
    
    // Check for day with ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const dayMatch = part.match(/^(\d+)(st|nd|rd|th)?$/);
    if (dayMatch) {
      dayPart = dayMatch[1];  // Extract just the number
      continue;
    }
  }

  if (!monthPart || !dayPart) {
    console.error(`Could not parse date format: ${dateStr}`);
    console.error(`Month part: ${monthPart}, Day part: ${dayPart}`);
    throw new Error(`Could not parse date format: ${dateStr}`);
  }

  const month = months[monthPart];
  const day = dayPart.padStart(2, '0');

  return `2025-${month}-${day}`;
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