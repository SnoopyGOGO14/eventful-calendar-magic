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

function determineStatusFromColor(color: any) {
  if (!color) {
    console.log('No color data found, defaulting to pending');
    return 'pending';
  }

  const { red = 0, green = 0, blue = 0 } = color;
  
  console.log('Raw color values:', { red, green, blue });

  // Green detection (confirmed)
  // Google Sheets green has high green value (>0.8) and low red/blue
  if (green > 0.8 && red < 0.5 && blue < 0.5) {
    console.log('Detected GREEN - Confirmed');
    return 'confirmed';
  }

  // Red detection (cancelled)
  // Google Sheets red has high red value (>0.8) and low green/blue
  if (red > 0.8 && green < 0.5 && blue < 0.5) {
    console.log('Detected RED - Cancelled');
    return 'cancelled';
  }

  // Yellow/Orange detection (pending)
  // Google Sheets yellow has both red and green high (>0.8) and low blue
  if (red > 0.8 && green > 0.8 && blue < 0.5) {
    console.log('Detected YELLOW - Pending');
    return 'pending';
  }

  console.log('No specific color match, defaulting to pending');
  return 'pending';
}

export function parseSheetRows(rows: string[][], formatting: any[]) {
  return rows
    .filter((row: string[], index: number) => {
      const hasDate = row[0]; // Column B (date)
      const hasContent = row.slice(1, 6).some(cell => cell?.trim()); // Check columns C through G
      if (hasDate && hasContent) {
        console.log(`Row ${index + 1}: Valid row with date and content`);
        return true;
      }
      console.log(`Row ${index + 1}: Skipped - No date or no content`);
      return false;
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
        const firstNonEmpty = [room, promoter, capacity, columnG].find(val => val !== '');
        if (firstNonEmpty) {
          console.log(`Row ${index + 1}: Using alternative column value as title: ${firstNonEmpty}`);
          title = firstNonEmpty;
        } else {
          console.log(`Row ${index + 1}: No title found in any column`);
          title = 'Untitled Event';
        }
      }
      
      // Get color from formatting data for Column G of the current row
      const cellFormat = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      console.log(`Row ${index + 1} color data:`, cellFormat);
      
      const status = determineStatusFromColor(cellFormat);
      console.log(`Row ${index + 1} determined status:`, status);

      const [dayName, monthName, dayNum] = dateStr.trim().split(' ')
      const month = new Date(`${monthName} 1, 2025`).getMonth()
      const day = parseInt(dayNum)
      
      if (month === 0 && day === 1) {
        console.log(`Skipping January 1st event: ${title}`);
        return null;
      }

      const date = new Date(2025, month, day)
      if (isNaN(date.getTime())) {
        console.warn(`Skipping invalid date in row ${index + 1}:`, dateStr)
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
