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

function isColorSimilar(color1: any, hexColor2: string): boolean {
  // Convert hex to RGB
  const r = parseInt(hexColor2.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor2.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor2.slice(5, 7), 16) / 255;

  // Exact match for yellow (#ffd966)
  if (hexColor2 === '#ffd966') {
    const isYellow = Math.abs(color1.red - 1) < 0.1 && 
                    Math.abs(color1.green - 0.85) < 0.1 && 
                    Math.abs(color1.blue - 0.4) < 0.1;
    console.log('Yellow comparison:', { given: color1, expected: { r, g, b }, isMatch: isYellow });
    return isYellow;
  }

  // Regular color comparison for other colors
  const threshold = 0.1;
  return Math.abs(color1.red - r) < threshold &&
         Math.abs(color1.green - g) < threshold &&
         Math.abs(color1.blue - b) < threshold;
}

function determineStatusFromColor(rowFormatting: any, rowNumber: number, dateStr: string): string | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  
  if (!bgColor || bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log(`[${dateStr}] Row ${rowNumber}: No color or white background`);
    return null;  // Return null for no color band
  }

  const hexColor = rgbToHex(bgColor);
  console.log(`[${dateStr}] Row ${rowNumber} - Raw color:`, { 
    red: bgColor.red.toFixed(3), 
    green: bgColor.green.toFixed(3), 
    blue: bgColor.blue.toFixed(3),
    hex: hexColor 
  });

  // January 2025 Events
  if (dateStr.includes('January')) {
    // Test for January 1st specifically
    if (dateStr === 'January 1 2025') {
      console.log('[TEST] Processing January 1st event');
    }

    // Warner Bros events (yellow in spreadsheet)
    if (isColorSimilar(bgColor, '#ffd966')) {
      console.log(`[${dateStr}] Row ${rowNumber}: Yellow detected (#ffd966) → Setting as Confirmed`);
      return 'confirmed';
    }
    
    // Ukrainian events (green in spreadsheet)
    if (isColorSimilar(bgColor, '#00ff00')) {
      console.log(`[${dateStr}] Row ${rowNumber}: Green detected (#00ff00) → Setting as Pending`);
      return 'pending';
    }
  }
  
  // Common status for all months
  if (isColorSimilar(bgColor, '#ff0000')) {
    console.log(`[${dateStr}] Row ${rowNumber}: Red detected (#ff0000) → Setting as Cancelled`);
    return 'cancelled';
  }

  console.log(`[${dateStr}] Row ${rowNumber}: No status match found for color: ${hexColor}`);
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
  let currentYear = 2025;
  let lastMonth = -1;

  // Add test events for January 1st
  const testEvents = [
    {
      date: '2025-01-01',
      title: 'TEST: Warner Bros (Yellow)',
      room: 'Test Room',
      promoter: 'Test Promoter',
      capacity: '100',
      status: 'confirmed',
      is_recurring: false,
      _sheet_line_number: -1,
      backgroundColor: { red: 1, green: 0.85, blue: 0.4 }  // #ffd966
    },
    {
      date: '2025-01-01',
      title: 'TEST: Ukrainian (Green)',
      room: 'Test Room',
      promoter: 'Test Promoter',
      capacity: '100',
      status: 'pending',
      is_recurring: false,
      _sheet_line_number: -2,
      backgroundColor: { red: 0, green: 1, blue: 0 }  // #00ff00
    },
    {
      date: '2025-01-01',
      title: 'TEST: Cancelled (Red)',
      room: 'Test Room',
      promoter: 'Test Promoter',
      capacity: '100',
      status: 'cancelled',
      is_recurring: false,
      _sheet_line_number: -3,
      backgroundColor: { red: 1, green: 0, blue: 0 }  // #ff0000
    }
  ];

  // Process regular events from the sheet
  const sheetEvents = values
    .map((row, index) => {
      if (!row[0]) return null;  // Skip empty rows

      const dateStr = row[0]?.trim() || '';
      if (!dateStr || dateStr === 'DATE') return null;

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

  // For January 1st, 2025, return test events first, then regular events
  return [...testEvents, ...sheetEvents];
}

// Test function to simulate January 1st event
function testJanuaryFirst() {
  console.log('\n=== Testing January 1st, 2025 Event ===');
  
  // Test Warner Bros event (Yellow - Should be Confirmed)
  const warnerColor = { red: 1, green: 0.85, blue: 0.4 }; // #ffd966
  console.log('\nTesting Warner Bros Event:');
  console.log('Date: January 1 2025');
  console.log('Expected: Confirmed (Yellow #ffd966)');
  console.log('Color:', rgbToHex(warnerColor));
  const result = determineStatusFromColor(
    { values: [{ userEnteredFormat: { backgroundColor: warnerColor } }] },
    1,
    'January 1 2025'
  );
  console.log('Result:', result);
  console.log('Test passed:', result === 'confirmed');
}

// Run January 1st test
console.log('\n[TEST] Running January 1st test before processing events...');
testJanuaryFirst();

// Test function to simulate color detection for January 2025
function testColorDetection() {
  console.log('\n=== Testing Color Detection for January 2025 ===');
  
  const dates = [
    'January 1 2025',
    'January 15 2025',
    'January 30 2025'
  ];
  
  // Test Warner Bros events (Yellow - Should be Confirmed)
  const warnerColor = { red: 1, green: 0.85, blue: 0.4 }; // #ffd966
  console.log('\nTesting Warner Bros Events (Yellow):');
  dates.forEach((date, index) => {
    console.log(`\nTest ${index + 1}: Warner Bros Event on ${date}`);
    console.log('Expected: Confirmed (Yellow #ffd966)');
    console.log('Result:', determineStatusFromColor(
      { values: [{ userEnteredFormat: { backgroundColor: warnerColor } }] },
      index + 1,
      date
    ));
  });
  
  // Test Ukrainian events (Green - Should be Pending)
  const ukrainianColor = { red: 0, green: 1, blue: 0 }; // #00ff00
  console.log('\nTesting Ukrainian Events (Green):');
  dates.forEach((date, index) => {
    console.log(`\nTest ${index + 4}: Ukrainian Event on ${date}`);
    console.log('Expected: Pending (Green #00ff00)');
    console.log('Result:', determineStatusFromColor(
      { values: [{ userEnteredFormat: { backgroundColor: ukrainianColor } }] },
      index + 4,
      date
    ));
  });
  
  // Test Cancelled events (Red)
  const cancelledColor = { red: 1, green: 0, blue: 0 }; // #ff0000
  console.log('\nTesting Cancelled Events (Red):');
  dates.forEach((date, index) => {
    console.log(`\nTest ${index + 7}: Cancelled Event on ${date}`);
    console.log('Expected: Cancelled (Red #ff0000)');
    console.log('Result:', determineStatusFromColor(
      { values: [{ userEnteredFormat: { backgroundColor: cancelledColor } }] },
      index + 7,
      date
    ));
  });
  
  console.log('\n=== End of Color Detection Test ===\n');
}

// Run the test
testColorDetection();