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

  console.log('\n=== DETAILED COLOR ANALYSIS ===');
  
  // Analyze each row, focusing on dates and background colors
  values.values?.forEach((row: any[], index: number) => {
    const dateStr = row[0]?.trim() || '';
    const rowNumber = index + 1;
    
    // Get background color for this row's Column G
    const bgColor = formatting.sheets?.[0]?.data?.[0]?.rowData?.[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
    
    if (rowNumber === 13) {
      console.log('\n=== LINE 13 DETAILED ANALYSIS ===');
      console.log(`Date: "${dateStr}"`);
      console.log('Raw background color data:', JSON.stringify(bgColor, null, 2));
      console.log('RGB Values:', {
        red: bgColor?.red || 0,
        green: bgColor?.green || 0,
        blue: bgColor?.blue || 0
      });
    }
  });

  return {
    values: values.values || [],
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || [],
  };
}

function determineStatusFromColor(bgColor: any, rowNumber: number) {
  if (!bgColor) {
    console.log(`Row ${rowNumber}: No background color found, defaulting to pending`);
    return 'pending';
  }

  const { red = 0, green = 0, blue = 0 } = bgColor;
  
  // Log exact RGB values for debugging
  console.log(`Row ${rowNumber} RGB values: R:${red} G:${green} B:${blue}`);
  
  // Yellow detection (high red and green, low blue)
  if (red > 0.8 && green > 0.8 && blue < 0.3) {
    console.log(`Row ${rowNumber}: Yellow detected (Pending)`);
    return 'pending';
  }
  
  // Green detection (high green, low red and blue)
  if (green > 0.8 && red < 0.3 && blue < 0.3) {
    console.log(`Row ${rowNumber}: Green detected (Confirmed)`);
    return 'confirmed';
  }
  
  // Red detection (high red, low green and blue)
  if (red > 0.8 && green < 0.3 && blue < 0.3) {
    console.log(`Row ${rowNumber}: Red detected (Cancelled)`);
    return 'cancelled';
  }

  console.log(`Row ${rowNumber}: No specific color match, defaulting to pending`);
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
      const dateStr = row[0]
      const columnC = row[1]?.trim() || ''
      const room = row[2]?.trim() || ''
      const promoter = row[3]?.trim() || ''
      const capacity = row[4]?.trim() || ''
      const columnG = row[5]?.trim() || ''

      let title = columnC;
      if (!title) {
        title = [room, promoter, capacity, columnG].find(val => val !== '') || 'Untitled Event';
      }
      
      const bgColor = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      const status = determineStatusFromColor(bgColor, index + 1);

      const [dayName, monthName, dayNum] = dateStr.trim().split(' ')
      const month = new Date(`${monthName} 1, 2025`).getMonth()
      const day = parseInt(dayNum)
      
      if (month === 0 && day === 1) return null;

      const date = new Date(2025, month, day)
      if (isNaN(date.getTime())) return null;

      // Special logging for line 13
      if (index + 1 === 13) {
        console.log('\n=== LINE 13 EVENT DATA ===');
        console.log('Date:', date.toISOString().split('T')[0]);
        console.log('Title:', title);
        console.log('Status:', status);
        console.log('Background Color:', bgColor);
      }

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