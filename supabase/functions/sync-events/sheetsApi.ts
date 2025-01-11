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

  // Fetch background color formatting for Column G with more detailed fields
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!G:G&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor,sheets.data.rowData.values.effectiveFormat.backgroundColor`,
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

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function isColorClose(color1: any, targetColor: { r: number, g: number, b: number }, tolerance: number = 0.1): boolean {
  if (!color1) return false;
  const { red = 0, green = 0, blue = 0 } = color1;
  
  return Math.abs(red - targetColor.r) <= tolerance &&
         Math.abs(green - targetColor.g) <= tolerance &&
         Math.abs(blue - targetColor.b) <= tolerance;
}

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string) {
  if (!bgColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No background color found, defaulting to pending`);
    return 'pending';
  }

  // Get both userEntered and effective format
  const userColor = bgColor?.userEnteredFormat?.backgroundColor;
  const effectiveColor = bgColor?.effectiveFormat?.backgroundColor;
  const finalColor = userColor || effectiveColor;

  if (!finalColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No color data found, defaulting to pending`);
    return 'pending';
  }

  const { red = 0, green = 0, blue = 0 } = finalColor;
  
  console.log(`Row ${rowNumber} (${dateStr}) RGB values: R:${red.toFixed(3)} G:${green.toFixed(3)} B:${blue.toFixed(3)}`);

  // Define standard Google Sheets colors
  const standardYellow = { r: 1, g: 0.85, b: 0.4 };  // Google Sheets yellow
  const standardGreen = { r: 0.27, g: 0.7, b: 0.27 }; // Google Sheets green
  const standardRed = { r: 0.8, g: 0.25, b: 0.25 };   // Google Sheets red

  // Check against standard colors with tolerance
  if (isColorClose(finalColor, standardYellow)) {
    console.log(`Row ${rowNumber} (${dateStr}): Matched YELLOW → Pending`);
    return 'pending';
  }
  
  if (isColorClose(finalColor, standardGreen)) {
    console.log(`Row ${rowNumber} (${dateStr}): Matched GREEN → Confirmed`);
    return 'confirmed';
  }
  
  if (isColorClose(finalColor, standardRed)) {
    console.log(`Row ${rowNumber} (${dateStr}): Matched RED → Cancelled`);
    return 'cancelled';
  }

  // Alternative method using relative color intensities
  const maxComponent = Math.max(red, green, blue);
  const colorIntensity = red + green + blue;

  if (colorIntensity > 1.5 && red > 0.7 && green > 0.7 && blue < 0.5) {
    console.log(`Row ${rowNumber} (${dateStr}): Intensity method detected YELLOW → Pending`);
    return 'pending';
  }

  if (green === maxComponent && green > 0.6 && red < 0.6) {
    console.log(`Row ${rowNumber} (${dateStr}): Intensity method detected GREEN → Confirmed`);
    return 'confirmed';
  }

  if (red === maxComponent && red > 0.6 && green < 0.6) {
    console.log(`Row ${rowNumber} (${dateStr}): Intensity method detected RED → Cancelled`);
    return 'cancelled';
  }

  console.log(`Row ${rowNumber} (${dateStr}): No specific color match, defaulting to pending`);
  return 'pending';
}

export function parseSheetRows(values: string[][], formatting: any[]) {
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
      
      const bgColor = formatting[index]?.values?.[0];
      const status = determineStatusFromColor(bgColor, index + 1, dateStr);

      const [dayName, monthName, dayNum] = dateStr.split(' ');
      const month = new Date(`${monthName} 1, 2025`).getMonth();
      const day = parseInt(dayNum);
      
      if (isNaN(month) || isNaN(day)) {
        console.log(`Row ${index + 1}: Invalid date format: "${dateStr}"`);
        return null;
      }

      const date = new Date(2025, month, day);
      
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