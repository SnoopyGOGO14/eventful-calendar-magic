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

function formatDate(dateStr: string): string {
  console.log('Formatting date:', dateStr);
  
  // If the date is already in YYYY-MM-DD format, return it as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  try {
    // Remove any day names and extra spaces
    const cleanDate = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '').trim();
    
    // Parse the date assuming it's for 2025
    const date = new Date(`${cleanDate}, 2025`);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    console.log(`Formatted date: ${dateStr} -> ${formattedDate}`);
    return formattedDate;
  } catch (error) {
    console.error(`Error parsing date "${dateStr}":`, error);
    throw new Error(`Invalid date format: ${dateStr}`);
  }
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

  // Fetch formatting for status column (G)
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
  
  // Check if it's white (skip)
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
  
  // Try different color formats
  const rgbWithSpaces = `rgb(${Math.round(bgColor.red * 255)}, ${Math.round(bgColor.green * 255)}, ${Math.round(bgColor.blue * 255)})`;
  const rgbWithoutSpaces = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  const hex = `#${Math.round(bgColor.red * 255).toString(16).padStart(2, '0')}${Math.round(bgColor.green * 255).toString(16).padStart(2, '0')}${Math.round(bgColor.blue * 255).toString(16).padStart(2, '0')}`.toUpperCase();
  
  console.log('Color formats:', {
    rgbWithSpaces,
    rgbWithoutSpaces,
    hex,
    mappings: SPREADSHEET_CELL_COLORS
  });
  
  // Try all formats
  const status = SPREADSHEET_CELL_COLORS[rgbWithSpaces] || 
                SPREADSHEET_CELL_COLORS[rgbWithoutSpaces] || 
                SPREADSHEET_CELL_COLORS[hex] || 
                'pending';
                
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

  return values.slice(1).map((row, index) => {
    if (!row || row.length < 1) {
      console.log(`Skipping empty row at index ${index + 1}`);
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    if (!date || !title) {
      console.log(`Skipping invalid row at index ${index + 1}: missing date or title`);
      return null;
    }
    
    try {
      const formattedDate = formatDate(date.trim());
      console.log(`Row ${index + 2}: Processing date=${date} -> ${formattedDate}`);
      
      // Get formatting for this row (add 1 to account for header)
      const rowFormatting = formatting[index + 1];
      const status = determineStatusFromColor(rowFormatting);
      
      console.log(`Row ${index + 2}: Final values:`, {
        date: formattedDate,
        title: title.trim(),
        status,
        room: room?.trim(),
        promoter: promoter?.trim(),
        capacity: capacity?.trim()
      });

      return {
        date: formattedDate,
        title: title.trim(),
        status,
        room: room?.trim() || '',
        promoter: promoter?.trim() || '',
        capacity: capacity?.trim() || '',
        _sheet_line_number: index + 2,
        is_recurring: false
      };
    } catch (error) {
      console.error(`Error processing row ${index + 2}:`, error);
      return null;
    }
  }).filter((row): row is Event => row !== null);
}