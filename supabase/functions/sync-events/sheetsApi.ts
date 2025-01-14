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
  
  // Fetch values (columns B through F)
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

  // Fetch formatting for status column (B)
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!B:B&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`,
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
  console.log('Processing row formatting:', JSON.stringify(rowFormatting));
  
  if (!rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor) {
    console.log('No background color found for row');
    return null;
  }
  
  const bgColor = rowFormatting.values[0].userEnteredFormat.backgroundColor;
  console.log('Raw background color:', bgColor);
  
  // Convert RGB values to 0-255 range
  const r = Math.round(bgColor.red * 255);
  const g = Math.round(bgColor.green * 255);
  const b = Math.round(bgColor.blue * 255);
  
  console.log(`Converted RGB values: R:${r} G:${g} B:${b}`);
  
  // Check if it's white (skip)
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log('Skipping white cell');
    return null;
  }

  return { red: r, green: g, blue: b };
}

function determineStatusFromColor(rowFormatting: any): EventStatus {
  const bgColor = getRowBackgroundColor(rowFormatting);
  if (!bgColor) {
    console.log('No background color, defaulting to pending');
    return 'pending';
  }
  
  // Generate all possible color formats
  const rgbWithSpaces = `rgb(${bgColor.red}, ${bgColor.green}, ${bgColor.blue})`;
  const rgbWithoutSpaces = `rgb(${bgColor.red},${bgColor.green},${bgColor.blue})`;
  const hex = `#${bgColor.red.toString(16).padStart(2, '0')}${bgColor.green.toString(16).padStart(2, '0')}${bgColor.blue.toString(16).padStart(2, '0')}`.toUpperCase();
  
  console.log('Trying to match color formats:', {
    rgbWithSpaces,
    rgbWithoutSpaces,
    hex,
    availableMappings: SPREADSHEET_CELL_COLORS
  });
  
  // Try all formats
  let status = SPREADSHEET_CELL_COLORS[rgbWithSpaces] || 
               SPREADSHEET_CELL_COLORS[rgbWithoutSpaces] || 
               SPREADSHEET_CELL_COLORS[hex];
               
  // If no match found, try approximate matching (allow for small RGB variations)
  if (!status) {
    console.log('No exact match found, trying approximate matching...');
    for (const [colorStr, mappedStatus] of Object.entries(SPREADSHEET_CELL_COLORS)) {
      if (colorStr.startsWith('rgb')) {
        const match = colorStr.match(/rgb\((\d+),?\s*(\d+),?\s*(\d+)\)/);
        if (match) {
          const [_, r, g, b] = match.map(Number);
          // Allow for small variations in RGB values (±5)
          if (Math.abs(r - bgColor.red) <= 5 && 
              Math.abs(g - bgColor.green) <= 5 && 
              Math.abs(b - bgColor.blue) <= 5) {
            console.log(`Found approximate match: ${colorStr} -> ${mappedStatus}`);
            status = mappedStatus;
            break;
          }
        }
      }
    }
  }
  
  status = status || 'pending';
  console.log('Final determined status:', status);
  return status;
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
    const rowFormatting = formatting[index];  
    const status = determineStatusFromColor(rowFormatting);
    console.log(`Row ${index + 2}: date=${date}, title=${title}, status=${status}`);

    return {
      date: formatDate(date.trim()),
      title: title.trim(),
      status,
      room: room?.trim() || '',
      promoter: promoter?.trim() || '',
      capacity: capacity?.trim() || '',
      _sheet_line_number: index + 2,  
      is_recurring: false
    };
  }).filter((row): row is Event => row !== null);
}