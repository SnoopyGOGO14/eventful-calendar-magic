export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data...');
  
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

  // Fetch background color formatting with more detailed metadata
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
  
  // Add detailed logging for the raw formatting data
  console.log('Raw formatting response:', JSON.stringify(formatting, null, 2));

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function isInRange(value: number, range: { min: number, max: number }): boolean {
  // Add some tolerance to the range check
  const tolerance = 0.01;
  return value >= (range.min - tolerance) && value <= (range.max + tolerance);
}

// Define more precise color ranges with wider tolerances
const TARGET_COLORS = {
  green: { 
    red: { min: 0.19, max: 0.21 }, 
    green: { min: 0.64, max: 0.67 }, 
    blue: { min: 0.31, max: 0.34 } 
  },
  yellow: { 
    red: { min: 0.97, max: 0.99 }, 
    green: { min: 0.72, max: 0.75 }, 
    blue: { min: 0.01, max: 0.03 } 
  },
  red: { 
    red: { min: 0.94, max: 1 }, 
    green: { min: 0, max: 0.1 }, 
    blue: { min: 0, max: 0.1 } 
  }
};

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string): string {
  if (!bgColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No background color found, defaulting to pending`);
    return 'pending';
  }

  // Add specific debug logging for April 18th
  if (dateStr.includes('April 18')) {
    console.log('DEBUGGING APRIL 18:', {
      rawColor: bgColor,
      red: Number(bgColor.red).toFixed(6),
      green: Number(bgColor.green).toFixed(6),
      blue: Number(bgColor.blue).toFixed(6),
      targetGreen: TARGET_COLORS.green
    });
  }

  // Log exact color values with more precision
  console.log(`Row ${rowNumber} (${dateStr}) - Exact color values:`, {
    red: Number(bgColor.red).toFixed(6),
    green: Number(bgColor.green).toFixed(6),
    blue: Number(bgColor.blue).toFixed(6)
  });

  // Check for green (confirmed)
  if (isInRange(bgColor.red, TARGET_COLORS.green.red) &&
      isInRange(bgColor.green, TARGET_COLORS.green.green) &&
      isInRange(bgColor.blue, TARGET_COLORS.green.blue)) {
    console.log(`Row ${rowNumber} (${dateStr}): GREEN detected → Confirmed`);
    return 'confirmed';
  }

  // Check for yellow (pending)
  if (isInRange(bgColor.red, TARGET_COLORS.yellow.red) &&
      isInRange(bgColor.green, TARGET_COLORS.yellow.green) &&
      isInRange(bgColor.blue, TARGET_COLORS.yellow.blue)) {
    console.log(`Row ${rowNumber} (${dateStr}): YELLOW detected → Pending`);
    return 'pending';
  }

  // Check for red (cancelled)
  if (isInRange(bgColor.red, TARGET_COLORS.red.red) &&
      isInRange(bgColor.green, TARGET_COLORS.red.green) &&
      isInRange(bgColor.blue, TARGET_COLORS.red.blue)) {
    console.log(`Row ${rowNumber} (${dateStr}): RED detected → Cancelled`);
    return 'cancelled';
  }

  // Check for white (1,1,1) explicitly
  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log(`Row ${rowNumber} (${dateStr}): WHITE detected → Pending`);
    return 'pending';
  }

  console.log(`Row ${rowNumber} (${dateStr}): No color match found for RGB(${bgColor.red}, ${bgColor.green}, ${bgColor.blue}), defaulting to pending`);
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
