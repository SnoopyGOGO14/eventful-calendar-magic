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

  // Fetch only background color formatting for Column G
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

  // Debug log for data validation
  console.log('\n=== SPREADSHEET DATA VALIDATION ===');
  
  // Analyze each row, focusing on dates and background colors
  values.values?.forEach((row: any[], index: number) => {
    const dateStr = row[0]?.trim() || ''; // Column B (date)
    const rowNumber = index + 1;
    
    // Get background color for this row's Column G
    const bgColor = formatting.sheets?.[0]?.data?.[0]?.rowData?.[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
    
    console.log(`\nRow ${rowNumber} Analysis:`);
    console.log(`Date in Column B: "${dateStr}"`);
    console.log(`Background Color in Column G:`, JSON.stringify(bgColor, null, 2));

    // Special attention to line 13 (January 18th, 2025)
    if (rowNumber === 13) {
      console.log('\n=== SPECIAL LINE 13 CHECK ===');
      console.log(`Line 13 date: "${dateStr}"`);
      if (dateStr.includes('Sat Jan 18')) {
        console.log('✅ Confirmed: Line 13 contains January 18th, 2025');
      } else {
        console.log('⚠️ Warning: Line 13 does not match expected January 18th date');
      }
    }
  });

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function determineStatusFromColor(bgColor: any, rowNumber: number) {
  if (!bgColor) {
    console.log(`Row ${rowNumber}: No background color found in Column G, defaulting to pending`);
    return 'pending';
  }

  const { red = 0, green = 0, blue = 0 } = bgColor;
  
  console.log(`Row ${rowNumber} Column G Background Color: R:${red} G:${green} B:${blue}`);
  
  // Clear threshold definitions for background colors
  const isGreen = green > Math.max(red, blue) && green > 0.5;
  const isRed = red > Math.max(green, blue) && red > 0.5;
  const isYellow = red > 0.5 && green > 0.5 && blue < 0.3;
  
  if (isGreen) {
    console.log(`Row ${rowNumber}: Green background detected (Confirmed)`);
    return 'confirmed';
  }
  if (isRed) {
    console.log(`Row ${rowNumber}: Red background detected (Cancelled)`);
    return 'cancelled';
  }
  if (isYellow) {
    console.log(`Row ${rowNumber}: Yellow background detected (Pending)`);
    return 'pending';
  }
  
  console.log(`Row ${rowNumber}: No specific background color detected, defaulting to pending`);
  return 'pending';
}

export function parseSheetRows(values: string[][], formatting: any[]) {
  return values
    .filter((row: string[], index: number) => {
      const hasDate = row[0]; // Column B (date)
      const hasContent = row.slice(1, 6).some(cell => cell?.trim()); // Check columns C through G
      return hasDate && hasContent;
    })
    .map((row: string[], index: number) => {
      const dateStr = row[0] // Column B
      const columnC = row[1]?.trim() || '' // Column C
      const room = row[2]?.trim() || '' // Column D
      const promoter = row[3]?.trim() || '' // Column E
      const capacity = row[4]?.trim() || '' // Column F
      const columnG = row[5]?.trim() || '' // Column G

      // Get title from first non-empty value
      let title = columnC;
      if (!title) {
        title = [room, promoter, capacity, columnG].find(val => val !== '') || 'Untitled Event';
      }
      
      // Get background color information for this row
      const bgColor = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      const status = determineStatusFromColor(bgColor, index + 1);

      // Parse date
      const [dayName, monthName, dayNum] = dateStr.trim().split(' ')
      const month = new Date(`${monthName} 1, 2025`).getMonth()
      const day = parseInt(dayNum)
      
      if (month === 0 && day === 1) return null;

      const date = new Date(2025, month, day)
      if (isNaN(date.getTime())) return null;

      return {
        date: date.toISOString().split('T')[0],
        title: title,
        room: room,
        promoter: promoter,
        capacity: capacity,
        status: status,
        is_recurring: false,
        _sheet_line_number: index + 1
      }
    })
    .filter(event => event !== null);
}