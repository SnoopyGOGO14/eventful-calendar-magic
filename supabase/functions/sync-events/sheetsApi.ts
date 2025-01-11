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

  // Fetch background color formatting for Column G
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

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string) {
  if (!bgColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No background color found, defaulting to pending`);
    return 'pending';
  }

  const { red = 0, green = 0, blue = 0 } = bgColor;
  
  console.log(`Row ${rowNumber} (${dateStr}) RGB values: R:${red.toFixed(3)} G:${green.toFixed(3)} B:${blue.toFixed(3)}`);

  // More precise color detection
  // Yellow detection (high red and green, low blue)
  if (red > 0.8 && green > 0.8 && blue < 0.3) {
    console.log(`Row ${rowNumber} (${dateStr}): YELLOW detected → Pending`);
    return 'pending';
  }
  
  // Green detection (predominantly green)
  if (green > 0.8 && red < 0.5 && blue < 0.5) {
    console.log(`Row ${rowNumber} (${dateStr}): GREEN detected → Confirmed`);
    return 'confirmed';
  }
  
  // Red detection (predominantly red)
  if (red > 0.8 && green < 0.5 && blue < 0.5) {
    console.log(`Row ${rowNumber} (${dateStr}): RED detected → Cancelled`);
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
      
      const bgColor = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      const status = determineStatusFromColor(bgColor, index + 1, dateStr);

      // Handle special date formats and ensure all dates are in 2025
      let date: Date;
      if (dateStr.toLowerCase().includes('nye')) {
        date = new Date(2025, 11, 31); // December 31st, 2025
      } else if (dateStr.toLowerCase().includes('nyd')) {
        date = new Date(2025, 0, 1); // January 1st, 2025
      } else {
        // Parse regular date format (e.g., "Friday January 3")
        const [dayName, monthName, dayNum] = dateStr.split(' ');
        const month = new Date(`${monthName} 1, 2025`).getMonth();
        const day = parseInt(dayNum);
        
        if (isNaN(month) || isNaN(day)) {
          console.log(`Row ${index + 1}: Invalid date format: "${dateStr}"`);
          return null;
        }

        date = new Date(2025, month, day);
      }
      
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