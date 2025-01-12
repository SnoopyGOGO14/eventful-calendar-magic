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

  // Process regular events from the sheet
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

    console.log(`Processing row ${index}:`, { row });

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
  .filter(event => {
    if (!event) {
      console.log('Filtering out null event');
      return false;
    }
    return true;
  });

  console.log('Processed sheet events:', allEvents.length);
  console.log('Total events:', allEvents.length);
  
  return allEvents;
}

// Test function to verify color detection
function testColorDetection() {
  console.log('\n=== Testing Color Detection ===\n');
  
  // Test Warner Bros (Green)
  const warnerFormat = {
    values: [{
      userEnteredFormat: {
        backgroundColor: { red: 0, green: 1, blue: 0 }  // #00ff00
      }
    }]
  };
  console.log('Testing Warner Bros GREEN:');
  console.log('Result:', determineStatusFromColor(warnerFormat, 1, 'TEST'));

  // Test Ukrainian (Yellow)
  const ukrainianFormat = {
    values: [{
      userEnteredFormat: {
        backgroundColor: { red: 1, green: 0.85, blue: 0.4 }  // #ffd966
      }
    }]
  };
  console.log('\nTesting Ukrainian YELLOW:');
  console.log('Result:', determineStatusFromColor(ukrainianFormat, 2, 'TEST'));

  // Test Cancelled (Red)
  const cancelledFormat = {
    values: [{
      userEnteredFormat: {
        backgroundColor: { red: 1, green: 0, blue: 0 }  // #ff0000
      }
    }]
  };
  console.log('\nTesting Cancelled RED:');
  console.log('Result:', determineStatusFromColor(cancelledFormat, 3, 'TEST'));
}

// Run color detection test when module loads
testColorDetection();

// Test function to simulate January 1st event
function testJanuaryFirst() {
  console.log('\n=== Testing January 1st, 2025 Event ===');
  
  // Test Warner Bros event (Green - Should be Confirmed)
  const warnerColor = { red: 0, green: 1, blue: 0 }; // #00ff00
  console.log('\nTesting Warner Bros Event:');
  console.log('Date: January 1 2025');
  console.log('Expected: Confirmed (Green #00ff00)');
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
function testColorDetectionForJanuary2025() {
  console.log('\n=== Testing Color Detection for January 2025 ===');
  
  const dates = [
    'January 1 2025',
    'January 15 2025',
    'January 30 2025'
  ];
  
  // Test Warner Bros events (Green - Should be Confirmed)
  const warnerColor = { red: 0, green: 1, blue: 0 }; // #00ff00
  console.log('\nTesting Warner Bros Events (Green):');
  dates.forEach((date, index) => {
    console.log(`\nTest ${index + 1}: Warner Bros Event on ${date}`);
    console.log('Expected: Confirmed (Green #00ff00)');
    console.log('Result:', determineStatusFromColor(
      { values: [{ userEnteredFormat: { backgroundColor: warnerColor } }] },
      index + 1,
      date
    ));
  });
  
  // Test Ukrainian events (Yellow - Should be Pending)
  const ukrainianColor = { red: 1, green: 0.85, blue: 0.4 }; // #ffd966
  console.log('\nTesting Ukrainian Events (Yellow):');
  dates.forEach((date, index) => {
    console.log(`\nTest ${index + 4}: Ukrainian Event on ${date}`);
    console.log('Expected: Pending (Yellow #ffd966)');
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
testColorDetectionForJanuary2025();