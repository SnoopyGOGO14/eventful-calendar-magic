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

  // Handle DD/MM format (assuming year 2025)
  const slashFormat = dateStr.split('/');
  if (slashFormat.length === 2) {
    const day = slashFormat[0].padStart(2, '0');
    const month = slashFormat[1].padStart(2, '0');
    return `2025-${month}-${day}`;
  }

  // Handle DD/MM/YYYY format
  if (slashFormat.length === 3) {
    const day = slashFormat[0].padStart(2, '0');
    const month = slashFormat[1].padStart(2, '0');
    const year = slashFormat[2].length === 2 ? `20${slashFormat[2]}` : slashFormat[2];
    return `${year}-${month}-${day}`;
  }

  // Handle full text format (e.g., "Saturday January 4")
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
  
  // Convert to RGB string format with rounding to handle floating point precision
  const rgb = `rgb(${Math.round(bgColor.red * 255)},${Math.round(bgColor.green * 255)},${Math.round(bgColor.blue * 255)})`;
  console.log('Converted RGB color:', rgb);
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
    
    try {
      const formattedDate = formatDate(date.trim());
      console.log(`Formatted date for row ${index + 2}: ${date} -> ${formattedDate}`);
      
      // Get formatting for this row, default to pending if not found
      const rowFormatting = formatting[index + 1];  // Add 1 to account for header
      const status = determineStatusFromColor(rowFormatting);
      console.log(`Row ${index + 2}: date=${formattedDate}, title=${title}, status=${status}`);

      return {
        date: formattedDate,
        title: title.trim(),
        status,
        room: room?.trim() || '',
        promoter: promoter?.trim() || '',
        capacity: capacity?.trim() || '',
        _sheet_line_number: index + 2,  // Add 2 to show actual sheet line number
        is_recurring: false
      };
    } catch (error) {
      console.error(`Error processing row ${index + 2}:`, error);
      return null;
    }
  }).filter((row): row is Event => row !== null);
}
