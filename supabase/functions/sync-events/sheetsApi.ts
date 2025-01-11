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

  // Detailed row analysis with line numbers
  console.log('\n=== SPREADSHEET ANALYSIS ===');
  console.log('Total rows found:', values.values ? values.values.length : 0);
  console.log('\n=== LINE BY LINE ANALYSIS ===');
  
  (values.values || []).forEach((row: any[], index: number) => {
    const lineNumber = index + 1;
    const dateValue = row[0] ? row[0].trim() : '';
    const hasDate = dateValue !== '';
    const color = formatting.sheets?.[0]?.data?.[0]?.rowData?.[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
    
    console.log(`Line ${lineNumber.toString().padStart(3, '0')}: ${hasDate ? '📅 HAS DATA' : '❌ BLANK   '}`);
    if (hasDate) {
      console.log(`   Date: "${dateValue}"`);
      console.log(`   Color: ${JSON.stringify(color)}`);
      console.log(`   Line Number: ${lineNumber}`);
    }
    console.log('   ---');
  });
  
  console.log('\n=== END OF ANALYSIS ===\n');

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
  
  // Simple dominant color check
  const maxValue = Math.max(red, green, blue);
  
  if (maxValue < 0.1) {
    console.log(`Line ${lineNumber}: Very dark/black cell, setting as pending`);
    return 'pending';
  }
  
  // Check which color is dominant
  if (maxValue === green) {
    console.log(`Line ${lineNumber}: Green dominant, setting as confirmed`);
    return 'confirmed';
  }
  if (maxValue === red) {
    console.log(`Line ${lineNumber}: Red dominant, setting as cancelled`);
    return 'cancelled';
  }
  
  console.log(`Line ${lineNumber}: No dominant color, defaulting to pending`);
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