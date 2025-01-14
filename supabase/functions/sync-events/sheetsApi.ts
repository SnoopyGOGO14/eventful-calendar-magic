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
  
  // Fetch both values and formatting in a single call
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!B:F&includeGridData=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Google Sheets API error: ${errorText}`);
    throw new Error(`Google Sheets API error: ${errorText}`);
  }

  const data = await response.json();
  console.log('Raw API response:', JSON.stringify(data, null, 2));
  
  // Extract values and formatting
  const sheet = data.sheets?.[0];
  const gridData = sheet?.data?.[0];
  
  if (!gridData) {
    throw new Error('No grid data found in response');
  }
  
  // Convert the grid data into our format
  const values = gridData.rowData?.map(row => 
    row.values?.map(cell => cell.formattedValue || '')
  ) || [];
  
  const formatting = gridData.rowData?.map(row => ({
    values: [{
      userEnteredFormat: {
        backgroundColor: row.values?.[0]?.userEnteredFormat?.backgroundColor
      }
    }]
  })) || [];
  
  console.log('Extracted values:', JSON.stringify(values.slice(0, 3), null, 2));
  console.log('Extracted formatting:', JSON.stringify(formatting.slice(0, 3), null, 2));
  
  return {
    values: values,
    formatting: formatting
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

export function parseSheetRows(values: string[][], formatting: any[] = []): Event[] {
  console.log('Starting to parse sheet rows...');
  console.log(`Number of rows: ${values?.length || 0}`);
  console.log(`Number of formatting rows: ${formatting?.length || 0}`);
  console.log('First few values:', JSON.stringify(values.slice(0, 3), null, 2));

  if (!values?.length) {
    console.log('No values found in sheet');
    return [];
  }

  const events = values.slice(1).map((row, index) => {
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
      
      // Get formatting for this row (account for header)
      const rowFormatting = formatting[index];
      console.log(`Row ${index + 2}: Formatting data:`, JSON.stringify(rowFormatting, null, 2));
      
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

  console.log('Final events array:', JSON.stringify(events, null, 2));
  return events;
}