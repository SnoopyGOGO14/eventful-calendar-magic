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
  const threshold = 0.2;  // More lenient threshold for matching
  const dr = Math.abs(color1.red - r2);
  const dg = Math.abs(color1.green - g2);
  const db = Math.abs(color1.blue - b2);

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
    isMatch: dr < threshold && dg < threshold && db < threshold
  });

  return dr < threshold && dg < threshold && db < threshold;
}

function determineStatusFromColor(rowFormatting: any, rowNumber: number, dateStr: string): EventStatus | null {
  const bgColor = getRowBackgroundColor(rowFormatting);
  
  if (!bgColor) {
    console.log(`[${dateStr}] Row ${rowNumber}: No background color found`);
    return null;
  }

  if (bgColor.red === 1 && bgColor.green === 1 && bgColor.blue === 1) {
    console.log(`[${dateStr}] Row ${rowNumber}: White background detected`);
    return null;
  }

  const hexColor = rgbToHex(bgColor);
  console.log(`[${dateStr}] Row ${rowNumber} - Detected cell color:`, { 
    red: bgColor.red.toFixed(3), 
    green: bgColor.green.toFixed(3), 
    blue: bgColor.blue.toFixed(3),
    hex: hexColor 
  });

  // Check Warner Bros (Green)
  console.log(`\nChecking if color matches Warner Bros GREEN (#00ff00):`);
  if (isColorSimilar(bgColor, '#00ff00')) {
    console.log(`✅ [${dateStr}] Row ${rowNumber}: GREEN match → Setting as "confirmed"`);
    return 'confirmed';
  }

  // Check Ukrainian (Yellow)
  console.log(`\nChecking if color matches Ukrainian YELLOW (#ffd966):`);
  if (isColorSimilar(bgColor, '#ffd966')) {
    console.log(`✅ [${dateStr}] Row ${rowNumber}: YELLOW match → Setting as "pending"`);
    return 'pending';
  }

  // Check Cancelled (Red)
  console.log(`\nChecking if color matches CANCELLED RED (#ff0000):`);
  if (isColorSimilar(bgColor, '#ff0000')) {
    console.log(`✅ [${dateStr}] Row ${rowNumber}: RED match → Setting as "cancelled"`);
    return 'cancelled';
  }

  console.log(`❌ [${dateStr}] Row ${rowNumber}: NO MATCH for color ${hexColor}`);
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

// Debug test function
function testColorDetection() {
  console.log('\n=== Testing Color Detection ===\n');
  
  const testCases = [
    {
      name: 'Warner Bros GREEN',
      color: { red: 0, green: 1, blue: 0 },  // #00ff00
      expected: 'confirmed'
    },
    {
      name: 'Ukrainian YELLOW',
      color: { red: 1, green: 0.85, blue: 0.4 },  // #ffd966
      expected: 'pending'
    },
    {
      name: 'CANCELLED RED',
      color: { red: 1, green: 0, blue: 0 },  // #ff0000
      expected: 'cancelled'
    },
    // Add some variations to test threshold
    {
      name: 'Slightly different green',
      color: { red: 0.1, green: 0.9, blue: 0.1 },
      expected: 'confirmed'
    },
    {
      name: 'Slightly different yellow',
      color: { red: 0.95, green: 0.8, blue: 0.35 },
      expected: 'pending'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
    const result = determineStatusFromColor(
      { values: [{ userEnteredFormat: { backgroundColor: testCase.color } }] },
      index + 1,
      'TEST'
    );
    console.log('Expected:', testCase.expected);
    console.log('Got:', result);
    console.log('Test passed:', result === testCase.expected);
  });
}

// Run color detection test
console.log('\n[DEBUG] Running color detection tests...');
testColorDetection();