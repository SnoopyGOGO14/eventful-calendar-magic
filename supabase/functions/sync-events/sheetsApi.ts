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

  // Fetch formatting for column G specifically
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

  // Extract the row data which contains the formatting information
  const rowFormatting = formatting.sheets?.[0]?.data?.[0]?.rowData || [];
  
  console.log('Column G formatting data:', JSON.stringify(rowFormatting, null, 2));

  return {
    values: values.values || [],
    formatting: rowFormatting
  };
}

function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  // Match pattern like "Tues 28" or "Mon 1" etc.
  const pattern = /^(Mon|Tues|Wed|Thurs|Fri|Sat|Sun)\s+\d{1,2}$/;
  return pattern.test(dateStr.trim());
}

function determineStatusFromColor(color: any) {
  if (!color) return 'pending';

  const { red = 0, green = 0, blue = 0 } = color;
  
  // Simple dominant color check
  const maxValue = Math.max(red, green, blue);
  
  if (maxValue < 0.1) return 'pending'; // Very dark/black cell
  
  // Check which color is dominant
  if (maxValue === green) return 'confirmed';
  if (maxValue === red) return 'cancelled';
  return 'pending';
}

export function parseSheetRows(rows: string[][], formatting: any[]) {
  return rows
    .map((row: string[], index: number) => {
      // Log the current line number (add 1 because array is 0-based)
      const lineNumber = index + 1;
      const dateStr = row[0]?.trim(); // Column B

      // Skip if date string is invalid
      if (!isValidDateString(dateStr)) {
        console.log(`Line ${lineNumber}: Skipping invalid/empty date: "${dateStr}"`);
        return null;
      }

      console.log(`Line ${lineNumber}: Processing date: "${dateStr}"`);

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
      
      // Get formatting for this row, accounting for header row
      const cellFormat = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      console.log(`Line ${lineNumber}: Cell format:`, cellFormat);
      
      const status = determineStatusFromColor(cellFormat);
      console.log(`Line ${lineNumber}: Determined status: ${status}`);

      const [dayName, monthName, dayNum] = dateStr.split(' ')
      const month = new Date(`${monthName} 1, 2025`).getMonth()
      const day = parseInt(dayNum)
      
      if (month === 0 && day === 1) return null;

      const date = new Date(2025, month, day)
      if (isNaN(date.getTime())) {
        console.log(`Line ${lineNumber}: Invalid date calculation`);
        return null;
      }

      return {
        date: date.toISOString().split('T')[0],
        title: title,
        room: room,
        promoter: promoter,
        capacity: capacity,
        status: status,
        is_recurring: false
      }
    })
    .filter(event => event !== null)
}