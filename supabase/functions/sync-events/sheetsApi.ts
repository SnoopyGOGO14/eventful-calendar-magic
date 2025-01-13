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

export function parseSheetRows(values: string[][], formatting: any[] = []) {
  console.log('Starting to parse sheet rows...');
  console.log(`Number of rows: ${values?.length || 0}`);
  console.log(`Number of formatting rows: ${formatting?.length || 0}`);
  
  if (!values || !Array.isArray(values)) {
    console.log('No valid rows found in sheet data');
    return [];
  }

  return values.slice(1).map((row, index) => {  // Skip header row
    if (!row || row.length < 1) {
      console.log(`Skipping empty row at index ${index + 1}`);  // Add 1 to account for header
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    if (!date || !title) {  // Remove date === 'DATE' check since we're skipping header
      console.log(`Skipping invalid row at index ${index + 1}: missing date or title`);
      return null;
    }
    
    // Get formatting for this row, default to pending if not found
    const rowFormatting = formatting[index + 1];  // Add 1 to account for header
    const status = rowFormatting ? determineStatusFromColor(rowFormatting) : 'pending';
    console.log(`Row ${index + 2}: date=${date}, title=${title}, status=${status}`);  // Add 2 to show actual sheet line number

    return {
      date: formatDate(date.trim()),  // Format date as YYYY-MM-DD
      title: title.trim(),
      status,
      room: room?.trim() || '',
      promoter: promoter?.trim() || '',
      capacity: capacity?.trim() || '',
      _sheet_line_number: index + 2,  // Add 2 to show actual sheet line number
      is_recurring: false
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
}