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

const TARGET_COLORS = {
  green: '#34a853',  // Maps to Confirmed
  yellow: '#fbbc04', // Maps to Pending
  red: '#ff0000'     // Maps to Cancelled
};

function determineStatusFromColor(rowFormatting: any, rowNumber: number, dateStr: string): string | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  
  if (!bgColor || bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log(`Row ${rowNumber} (${dateStr}): No color or white background`);
    return null;  // Return null for no color band
  }

  const hexColor = rgbToHex(bgColor);
  console.log(`Row ${rowNumber} (${dateStr}) - Detected color: ${hexColor}`);

  // Fixed color mapping to match spreadsheet
  if (isColorSimilar(bgColor, '#ffd966')) {  // Yellow/Orange
    console.log(`Row ${rowNumber}: YELLOW detected → Confirmed`);
    return 'confirmed';  // For Warner Bros events (yellow in spreadsheet)
  }
  if (isColorSimilar(bgColor, '#00ff00')) {  // Bright Green
    console.log(`Row ${rowNumber}: GREEN detected → Pending`);
    return 'pending';   // For Ukrainian event (green in spreadsheet)
  }
  if (isColorSimilar(bgColor, '#ff0000')) {  // Red
    console.log(`Row ${rowNumber}: RED detected → Cancelled`);
    return 'cancelled';
  }

  console.log(`Row ${rowNumber}: No color match found`);
  return null;  // Return null for any unrecognized colors
}

function isColorSimilar(color1: any, hexColor2: string): boolean {
  // Convert hex color2 to RGB
  const r2 = parseInt(hexColor2.slice(1, 3), 16) / 255;
  const g2 = parseInt(hexColor2.slice(3, 5), 16) / 255;
  const b2 = parseInt(hexColor2.slice(5, 7), 16) / 255;

  // Compare with tolerance
  const tolerance = 0.2;  // Increased from 0.1 for better matching
  return Math.abs(color1.red - r2) <= tolerance &&
         Math.abs(color1.green - g2) <= tolerance &&
         Math.abs(color1.blue - b2) <= tolerance;
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
  let currentYear = 2024;
  let lastMonth = 11;

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
      
      const status = determineStatusFromColor(formatting[index], index + 1, dateStr);

      // Parse the date string
      const parts = dateStr.split(' ');
      if (parts.length < 3) {
        console.log(`Row ${index + 1}: Invalid date format: "${dateStr}"`);
        return null;
      }
      
      const monthName = parts[1];
      const dayNum = parseInt(parts[2]);
      
      const month = new Date(`${monthName} 1, 2025`).getMonth();
      
      if (isNaN(month) || isNaN(dayNum)) {
        console.log(`Row ${index + 1}: Invalid date format: "${dateStr}"`);
        return null;
      }

      if (month < lastMonth) {
        currentYear++;
      }
      lastMonth = month;

      const date = new Date(currentYear, month, dayNum);

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

// Test function to simulate color detection
function testColorDetection() {
  console.log('\n=== Testing Color Detection for January 1st, 2025 ===');
  
  // Test Warner Bros event (should be Confirmed - Yellow in spreadsheet)
  const warnerColor = { red: 1, green: 0.85, blue: 0.4 };  // #ffd966 (Yellow/Orange)
  console.log('\nTest 1: Warner Bros Event');
  console.log('Date: January 1, 2025');
  console.log('Expected: Confirmed (Yellow in spreadsheet)');
  console.log('Color:', rgbToHex(warnerColor));
  console.log('Result:', determineStatusFromColor({ values: [{ userEnteredFormat: { backgroundColor: warnerColor } }] }, 1, 'January 1 2025'));
  
  // Test Ukrainian event (should be Pending - Green in spreadsheet)
  const ukrainianColor = { red: 0, green: 1, blue: 0 };  // #00ff00 (Bright Green)
  console.log('\nTest 2: Ukrainian Event');
  console.log('Date: January 1, 2025');
  console.log('Expected: Pending (Green in spreadsheet)');
  console.log('Color:', rgbToHex(ukrainianColor));
  console.log('Result:', determineStatusFromColor({ values: [{ userEnteredFormat: { backgroundColor: ukrainianColor } }] }, 2, 'January 1 2025'));
  
  // Test Cancelled event (Red)
  const cancelledColor = { red: 1, green: 0, blue: 0 };  // #ff0000 (Red)
  console.log('\nTest 3: Cancelled Event');
  console.log('Date: January 1, 2025');
  console.log('Expected: Cancelled (Red)');
  console.log('Color:', rgbToHex(cancelledColor));
  console.log('Result:', determineStatusFromColor({ values: [{ userEnteredFormat: { backgroundColor: cancelledColor } }] }, 3, 'January 1 2025'));
  
  console.log('\n=== End of Color Detection Test ===\n');
}

// Run the test
testColorDetection();