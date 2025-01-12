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

  console.log('Found background color in column G:', bgColor);
  return bgColor;
}

function isColorSimilar(color1: any, hexColor2: string): boolean {
  if (!color1) return false;

  // Convert hex color to RGB
  const r2 = parseInt(hexColor2.slice(1, 3), 16) / 255;
  const g2 = parseInt(hexColor2.slice(3, 5), 16) / 255;
  const b2 = parseInt(hexColor2.slice(5, 7), 16) / 255;

  // Calculate color difference using a simple distance formula
  const threshold = 0.3;  // More lenient threshold for matching
  const dr = Math.abs(color1.red - r2);
  const dg = Math.abs(color1.green - g2);
  const db = Math.abs(color1.blue - b2);

  // Special case for Warner Bros green
  if (hexColor2 === '#00ff00') {
    // If it's mostly green with little red and blue, it's probably Warner Bros
    if (color1.green > 0.7 && color1.red < 0.3 && color1.blue < 0.3) {
      console.log('Detected Warner Bros green (high green, low red/blue)');
      return true;
    }
  }

  const isMatch = dr < threshold && dg < threshold && db < threshold;
  console.log('Color comparison:', {
    input: {
      red: color1.red.toFixed(3),
      green: color1.green.toFixed(3),
      blue: color1.blue.toFixed(3),
      hex: rgbToHex(color1)
    },
    target: {
      red: r2.toFixed(3),
      green: g2.toFixed(3),
      blue: b2.toFixed(3),
      hex: hexColor2
    },
    differences: {
      red: dr.toFixed(3),
      green: dg.toFixed(3),
      blue: db.toFixed(3)
    },
    threshold,
    isMatch
  });

  return isMatch;
}

function determineStatusFromColor(rowFormatting: any, rowNumber: number, dateStr: string): EventStatus | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  
  if (!bgColor) {
    console.log(`[${dateStr}] Row ${rowNumber}: No background color found in column G`);
    return null;
  }

  const hexColor = rgbToHex(bgColor);
  console.log(`[${dateStr}] Row ${rowNumber} - Detected column G color:`, { 
    red: bgColor.red.toFixed(3), 
    green: bgColor.green.toFixed(3), 
    blue: bgColor.blue.toFixed(3),
    hex: hexColor 
  });

  // First check Warner Bros (Green) - Most important
  if (bgColor.green > 0.7 && bgColor.red < 0.3 && bgColor.blue < 0.3) {
    console.log(`✅ [${dateStr}] Row ${rowNumber}: GREEN detected in column G → Setting as "confirmed"`);
    return 'confirmed';
  }

  // Then check Ukrainian (Yellow)
  if (isColorSimilar(bgColor, '#ffd966')) {
    console.log(`✅ [${dateStr}] Row ${rowNumber}: YELLOW match in column G → Setting as "pending"`);
    return 'pending';
  }

  // Finally check Cancelled (Red)
  if (isColorSimilar(bgColor, '#ff0000')) {
    console.log(`✅ [${dateStr}] Row ${rowNumber}: RED match in column G → Setting as "cancelled"`);
    return 'cancelled';
  }

  console.log(`❌ [${dateStr}] Row ${rowNumber}: NO MATCH for color ${hexColor} in column G`);
  return null;
}

function rgbToHex(color: { red: number; green: number; blue: number }): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
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
    // Skip if no date or empty row
    if (!row[0] || !row.some(cell => cell?.trim())) {
      console.log(`Row ${index}: Skipping - Empty row`);
      return null;
    }

    const dateStr = row[0]?.trim() || '';
    if (!dateStr || dateStr === 'DATE') {
      console.log(`Row ${index}: Skipping header or empty date`);
      return null;
    }

    // Parse the date string first to validate it
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

    // Get status from background color
    const status = determineStatusFromColor(formatting[index], index + 1, dateStr);
    if (!status) {
      console.log(`Row ${index}: Skipping - No valid status color found`);
      return null;
    }

    // Extract event details
    const columnC = row[1]?.trim() || '';
    const room = row[2]?.trim() || '';
    const promoter = row[3]?.trim() || '';
    const capacity = row[4]?.trim() || '';
    const columnG = row[5]?.trim() || '';

    // Skip if no meaningful content
    if (!columnC && !room && !promoter && !capacity && !columnG) {
      console.log(`Row ${index}: Skipping - No event details`);
      return null;
    }

    // Update year if month rolls over
    if (month < lastMonth) {
      currentYear++;
    }
    lastMonth = month;

    const date = new Date(currentYear, month, dayNum);
    const event = {
      date: date.toISOString().split('T')[0],
      title: columnC || [room, promoter, capacity, columnG].find(val => val !== '') || 'Untitled Event',
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

  console.log('Total valid events:', allEvents.length);
  return allEvents;
}