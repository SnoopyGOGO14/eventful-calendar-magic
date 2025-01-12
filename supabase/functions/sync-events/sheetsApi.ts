import { EventStatus, SPREADSHEET_CELL_COLORS } from '../../src/types/eventStatus';

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data...');
  
  // Fetch the values from columns B to I
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:I`,
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

  // Fetch background color formatting for the entire row
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!B:I&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`,
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

function getRowBackgroundColor(rowFormatting: any): any {
  if (!rowFormatting?.values) return null;
  
  // Look through all cells in the row for a background color
  for (const cell of rowFormatting.values) {
    const bgColor = cell?.userEnteredFormat?.backgroundColor;
    if (bgColor) {
      return bgColor;
    }
  }
  return null;
}

function isColorSimilar(color1: any, hexColor2: string): boolean {
  // Convert hex color to RGB
  const r2 = parseInt(hexColor2.slice(1, 3), 16) / 255;
  const g2 = parseInt(hexColor2.slice(3, 5), 16) / 255;
  const b2 = parseInt(hexColor2.slice(5, 7), 16) / 255;

  // Calculate color difference using a simple distance formula
  const threshold = 0.1;  // Increase for more lenient matching
  const dr = Math.abs(color1.red - r2);
  const dg = Math.abs(color1.green - g2);
  const db = Math.abs(color1.blue - b2);

  console.log('Color comparison:', {
    color1: { r: color1.red, g: color1.green, b: color1.blue },
    color2: { r: r2, g: g2, b: b2 },
    differences: { dr, dg, db },
    threshold
  });

  return dr < threshold && dg < threshold && db < threshold;
}

function determineStatusFromColor(rowFormatting: any, rowNumber: number, dateStr: string): EventStatus | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  
  if (!bgColor || bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log(`[${dateStr}] Row ${rowNumber}: No color or white background`);
    return null;
  }

  const hexColor = rgbToHex(bgColor);
  console.log(`[${dateStr}] Row ${rowNumber} - Cell color:`, { 
    red: bgColor.red, 
    green: bgColor.green, 
    blue: bgColor.blue,
    hex: hexColor 
  });

  // Check each spreadsheet color and return corresponding status
  for (const [cellColor, status] of Object.entries(SPREADSHEET_CELL_COLORS)) {
    if (isColorSimilar(bgColor, cellColor)) {
      console.log(`[${dateStr}] Row ${rowNumber}: Matched ${cellColor} → "${status}" status`);
      return status;
    }
  }

  console.log(`[${dateStr}] Row ${rowNumber}: No match for color ${hexColor}`);
  return null;
}

function rgbToHex(color: { red: number; green: number; blue: number }): string {
  if (!color) return '#ffffff';
  
  const toHex = (n: number) => {
    const hex = Math.round((n || 0) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return '#' + toHex(color.red) + toHex(color.green) + toHex(color.blue);
}

export function parseSheetRows(values: string[][], formatting: any[]) {
  console.log('Starting to parse sheet rows. Total rows:', values.length);
  
  let currentYear = 2025;
  let lastMonth = -1;

  // Process events from the sheet
  const allEvents = values.map((row, index) => {
    if (!row[0]) {
      console.log(`Row ${index}: Skipping - No date`);
      return null;
    }

    const hasContent = row.slice(1, 6).some(cell => cell?.trim());
    if (!hasContent) {
      console.log(`Row ${index}: Skipping - No content`);
      return null;
    }

    const dateStr = row[0]?.trim() || '';
    if (!dateStr || dateStr === 'DATE') {
      console.log(`Row ${index}: Skipping header or empty date`);
      return null;
    }

    const columnC = row[1]?.trim() || '';
    const room = row[2]?.trim() || '';
    const promoter = row[3]?.trim() || '';
    const capacity = row[4]?.trim() || '';
    const columnG = row[5]?.trim() || '';

    let title = columnC;
    if (!title) {
      title = [room, promoter, capacity, columnG].find(val => val !== '') || 'Untitled Event';
    }
    
    const status = determineStatusFromColor(formatting[index], index + 1, dateStr);
    console.log(`Status determined for row ${index}:`, status);

    // Parse the date string
    const parts = dateStr.split(' ');
    if (parts.length < 3) {
      console.log(`Row ${index}: Invalid date format: "${dateStr}"`);
      return null;
    }
    
    const monthName = parts[1];
    const dayNum = parseInt(parts[2]);
    
    const month = new Date(`${monthName} 1, 2025`).getMonth();
    
    if (isNaN(month) || isNaN(dayNum)) {
      console.log(`Row ${index}: Invalid date format: "${dateStr}"`);
      return null;
    }

    if (month < lastMonth) {
      currentYear++;
    }
    lastMonth = month;

    const date = new Date(currentYear, month, dayNum);
    const event = {
      date: date.toISOString().split('T')[0],
      title,
      room,
      promoter,
      capacity,
      status,
      is_recurring: false,
      _sheet_line_number: index + 1
    };

    console.log(`Created event for row ${index}:`, event);
    return event;
  })
  .filter(event => event !== null);

  console.log('Total events:', allEvents.length);
  return allEvents;
}