import { fetchSheetData, parseSheetRows } from './sheetsApi.ts'

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  // First fetch the values (including dates from Column B)
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:I`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!valuesResponse.ok) {
    throw new Error(`Google Sheets API error: ${await valuesResponse.text()}`);
  }

  // Fetch background color formatting for Column G
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!G:G&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!formattingResponse.ok) {
    throw new Error(`Google Sheets API formatting error: ${await formattingResponse.text()}`);
  }

  const values = await valuesResponse.json();
  const formatting = await formattingResponse.json();

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function hexToRgb(hex: string) {
  const bigint = parseInt(hex.slice(1), 16);
  return {
    red: ((bigint >> 16) & 255) / 255,
    green: ((bigint >> 8) & 255) / 255,
    blue: (bigint & 255) / 255,
  };
}

function isColorInRange(color: any, target: any, tolerance: number) {
  if (!color) return false;
  return (
    Math.abs(color.red - target.red) <= tolerance &&
    Math.abs(color.green - target.green) <= tolerance &&
    Math.abs(color.blue - target.blue) <= tolerance
  );
}

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string) {
  if (!bgColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No background color found, defaulting to pending`);
    return 'pending';
  }

  // If bgColor is in hex, convert it to RGB
  if (typeof bgColor === 'string' && bgColor.startsWith('#')) {
    bgColor = hexToRgb(bgColor);
  }

  // Define standard colors
  const YELLOW = { red: 1, green: 1, blue: 0 };
  const GREEN = { red: 0, green: 1, blue: 0 };
  const RED = { red: 1, green: 0, blue: 0 };
  const TOLERANCE = 0.25; // Increased tolerance for better detection

  // Log exact RGB values for debugging
  console.log(`Row ${rowNumber} (${dateStr}) - RGB values:`, {
    red: bgColor.red?.toFixed(3),
    green: bgColor.green?.toFixed(3),
    blue: bgColor.blue?.toFixed(3)
  });

  // Check against standard colors
  if (isColorInRange(bgColor, YELLOW, TOLERANCE)) {
    console.log(`Row ${rowNumber} (${dateStr}): YELLOW detected → Pending`);
    return 'pending';
  }
  if (isColorInRange(bgColor, GREEN, TOLERANCE)) {
    console.log(`Row ${rowNumber} (${dateStr}): GREEN detected → Confirmed`);
    return 'confirmed';
  }
  if (isColorInRange(bgColor, RED, TOLERANCE)) {
    console.log(`Row ${rowNumber} (${dateStr}): RED detected → Cancelled`);
    return 'cancelled';
  }

  // Additional check for light yellow (which might appear more white-ish)
  if (bgColor.red > 0.9 && bgColor.green > 0.9 && bgColor.blue < 0.3) {
    console.log(`Row ${rowNumber} (${dateStr}): Light YELLOW detected → Pending`);
    return 'pending';
  }

  console.log(`Row ${rowNumber} (${dateStr}): No specific color match, defaulting to pending`);
  return 'pending';
}

export function parseSheetRows(values: string[][], formatting: any[]) {
  let currentYear = 2024; // Start with December 2024
  let lastMonth = 11; // December is month 11 (0-based)

  return values
    .filter((row: string[], index: number) => {
      const hasDate = row[0];
      const hasContent = row.slice(1, 6).some(cell => cell?.trim());
      return hasDate && hasContent;
    })
    .map((row: string[], index: number) => {
      const dateStr = row[0]?.trim() || '';
      const columnC = row[1]?.trim() || '';
      const room = row[2]?.trim() || '';
      const promoter = row[3]?.trim() || '';
      const capacity = row[4]?.trim() || '';
      const columnG = row[5]?.trim() || '';

      let title = columnC;
      if (!title) {
        title = [room, promoter, capacity, columnG].find(val => val !== '') || 'Untitled Event';
      }
      
      const bgColor = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      const status = determineStatusFromColor(bgColor, index + 1, dateStr);

      // Parse the date string
      const parts = dateStr.split(' ');
      if (parts.length < 3) {
        console.log(`Row ${index + 1}: Invalid date format: "${dateStr}"`);
        return null;
      }
      
      const monthName = parts[1];
      const dayNum = parseInt(parts[2]);
      
      // Get month number (0-based)
      const month = new Date(`${monthName} 1, 2025`).getMonth();
      
      if (isNaN(month) || isNaN(dayNum)) {
        console.log(`Row ${index + 1}: Invalid date format: "${dateStr}"`);
        return null;
      }

      // If we see a month that's earlier than the last month we processed,
      // we've crossed into a new year
      if (month < lastMonth) {
        currentYear++;
      }
      lastMonth = month;

      const date = new Date(currentYear, month, dayNum);
      console.log(`Row ${index + 1}: Event parsed for ${date.toISOString()}`);

      // Validate date
      if (isNaN(date.getTime())) {
        console.log(`Row ${index + 1}: Could not parse date: "${dateStr}"`);
        return null;
      }

      return {
        date: date.toISOString().split('T')[0],
        title,
        room,
        promoter,
        capacity,
        status,
        is_recurring: false,
        _sheet_line_number: index + 1
      };
    })
    .filter(event => event !== null);
}
