import { fetchSheetData, parseSheetRows } from './sheetsApi.ts'

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  // First fetch the values
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

  // Fetch formatting for column G specifically, including row data
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

  // Special check for line 13 (January 18th, 2025)
  console.log('\n=== SPECIAL LINE 13 CHECK ===');
  const line13Index = 12; // 0-based index for line 13
  const line13Data = values.values?.[line13Index] || [];
  const line13Date = line13Data[0]?.trim() || '';
  const line13Color = formatting.sheets?.[0]?.data?.[0]?.rowData?.[line13Index]?.values?.[0]?.userEnteredFormat?.backgroundColor;

  console.log('Line 13 Analysis:');
  console.log(`Date in spreadsheet: "${line13Date}"`);
  console.log(`Color data:`, JSON.stringify(line13Color, null, 2));

  if (line13Date.includes('Sat Jan 18')) {
    console.log('✅ Date match confirmed for Line 13: January 18th, 2025');
    console.log('Color Analysis for Line 13:');
    const status = determineStatusFromColor(line13Color, 13);
    console.log(`Final status determination: ${status}`);
  } else {
    console.log('⚠️ Line 13 does not contain January 18th, 2025');
    console.log(`Found date: ${line13Date}`);
  }

  // Continue with regular analysis
  console.log('\n=== REGULAR SPREADSHEET ANALYSIS ===');

  // Extract the row data which contains the formatting information
  const rowFormatting = formatting.sheets?.[0]?.data?.[0]?.rowData || [];
  
  return {
    values: values.values || [],
    formatting: rowFormatting,
    lineNumbers: values.values ? values.values.map((_: any, index: number) => index + 1) : []
  };
}

function determineStatusFromColor(color: any, lineNumber: number) {
  if (!color) {
    console.log(`Line ${lineNumber}: No color found, defaulting to pending`);
    return 'pending';
  }

  const { red = 0, green = 0, blue = 0 } = color;
  
  console.log(`Line ${lineNumber}: Color values - R:${red} G:${green} B:${blue}`);
  
  // Enhanced color detection with specific thresholds
  const isGreen = green > Math.max(red, blue) && green > 0.5;
  const isRed = red > Math.max(green, blue) && red > 0.5;
  const isYellow = red > 0.5 && green > 0.5 && blue < 0.3;
  
  if (isGreen) {
    console.log(`Line ${lineNumber}: Green dominant (Confirmed)`);
    return 'confirmed';
  }
  if (isRed) {
    console.log(`Line ${lineNumber}: Red dominant (Cancelled)`);
    return 'cancelled';
  }
  if (isYellow) {
    console.log(`Line ${lineNumber}: Yellow detected (Pending)`);
    return 'pending';
  }
  
  console.log(`Line ${lineNumber}: No clear color dominance, defaulting to pending`);
  return 'pending';
}

export function parseSheetRows(rows: string[][], formatting: any[]) {
  return rows
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

      // Find the first non-empty value to use as title
      let title = columnC;
      if (!title) {
        title = [room, promoter, capacity, columnG].find(val => val !== '') || 'Untitled Event';
      }
      
      // Get color information for this specific row
      const cellFormat = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      const status = determineStatusFromColor(cellFormat, index + 1);

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
        _sheet_line_number: index + 1 // Store the line number
      }
    })
    .filter(event => event !== null)
}
