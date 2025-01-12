// Update these to match your exact spreadsheet colors
const TARGET_COLORS = {
  green: '#34a853',  // Confirmed
  yellow: '#fbbc04', // Pending
  red: '#ff0000'     // Cancelled
};

function rgbToHex(color: { red: number; green: number; blue: number }): string {
  if (!color) return '#ffffff';
  
  const toHex = (n: number) => {
    const hex = Math.round((n || 0) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return '#' + toHex(color.red) + toHex(color.green) + toHex(color.blue);
}

function isCloseTo(color1: string, color2: string, tolerance: number = 30): boolean {
  // Convert hex to RGB
  const hex1 = color1.substring(1);
  const hex2 = color2.substring(1);
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  return Math.abs(r1 - r2) <= tolerance &&
         Math.abs(g1 - g2) <= tolerance &&
         Math.abs(b1 - b2) <= tolerance;
}

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string): string {
  if (!bgColor) {
    console.log(`Row ${rowNumber}: No color found, defaulting to pending`);
    return 'pending';
  }

  const hexColor = rgbToHex(bgColor);
  console.log(`Row ${rowNumber} - Color detected: ${hexColor}`);
  
  if (isCloseTo(hexColor, TARGET_COLORS.green)) {
    console.log(`Row ${rowNumber}: Matched GREEN → Confirmed`);
    return 'confirmed';
  }
  if (isCloseTo(hexColor, TARGET_COLORS.yellow)) {
    console.log(`Row ${rowNumber}: Matched YELLOW → Pending`);
    return 'pending';
  }
  if (isCloseTo(hexColor, TARGET_COLORS.red)) {
    console.log(`Row ${rowNumber}: Matched RED → Cancelled`);
    return 'cancelled';
  }

  console.log(`Row ${rowNumber}: No match found for ${hexColor}, defaulting to pending`);
  return 'pending';
}

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
  
  console.log('Raw formatting response:', JSON.stringify(formatting, null, 2));

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
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
      console.log(`Row ${index + 1}: Event parsed for ${date.toISOString()}`);

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