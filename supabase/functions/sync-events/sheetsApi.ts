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

// Define standard colors with more flexible ranges
const TARGET_COLORS = {
  yellow: { 
    red: { min: 0.9, max: 1 }, 
    green: { min: 0.8, max: 1 }, 
    blue: { min: 0, max: 0.2 } 
  },
  green: { 
    red: { min: 0, max: 0.3 }, 
    green: { min: 0.7, max: 1 }, 
    blue: { min: 0, max: 0.3 } 
  },
  red: { 
    red: { min: 0.7, max: 1 }, 
    green: { min: 0, max: 0.3 }, 
    blue: { min: 0, max: 0.3 } 
  }
};

function hexToRgb(hex: string) {
  hex = hex.replace(/^#/, '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  
  return {
    red: r / 255,
    green: g / 255,
    blue: b / 255
  };
}

function isInRange(value: number, range: { min: number, max: number }): boolean {
  return value >= range.min && value <= range.max;
}

function isColorMatch(color: any, targetRanges: any): boolean {
  if (!color) return false;
  
  console.log('Color check:', {
    color,
    targetRanges,
    redInRange: isInRange(color.red, targetRanges.red),
    greenInRange: isInRange(color.green, targetRanges.green),
    blueInRange: isInRange(color.blue, targetRanges.blue)
  });

  return (
    isInRange(color.red, targetRanges.red) &&
    isInRange(color.green, targetRanges.green) &&
    isInRange(color.blue, targetRanges.blue)
  );
}

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string): string {
  if (!bgColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No background color found, defaulting to pending`);
    return 'pending';
  }

  // Convert hex format to RGB if needed
  if (typeof bgColor === 'string' && bgColor.startsWith('#')) {
    bgColor = hexToRgb(bgColor);
  }

  // Log the exact color values
  console.log(`Row ${rowNumber} (${dateStr}) - Color values:`, {
    red: bgColor.red?.toFixed(3),
    green: bgColor.green?.toFixed(3),
    blue: bgColor.blue?.toFixed(3)
  });

  // Check colors with detailed logging
  if (isColorMatch(bgColor, TARGET_COLORS.yellow)) {
    console.log(`Row ${rowNumber} (${dateStr}): YELLOW detected → Pending`);
    return 'pending';
  }
  
  if (isColorMatch(bgColor, TARGET_COLORS.green)) {
    console.log(`Row ${rowNumber} (${dateStr}): GREEN detected → Confirmed`);
    return 'confirmed';
  }
  
  if (isColorMatch(bgColor, TARGET_COLORS.red)) {
    console.log(`Row ${rowNumber} (${dateStr}): RED detected → Cancelled`);
    return 'cancelled';
  }

  // Additional check for light yellow (which might appear more white-ish)
  if (bgColor.red > 0.9 && bgColor.green > 0.9 && bgColor.blue < 0.3) {
    console.log(`Row ${rowNumber} (${dateStr}): Light YELLOW detected → Pending`);
    return 'pending';
  }

  console.log(`Row ${rowNumber} (${dateStr}): No color match found, defaulting to pending`);
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
