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

export function parseSheetRows(rows: string[][], formatting: any[]) {
  return rows
    // Changed filter condition to check if date exists and any content in columns C through G
    .filter((row: string[], index: number) => {
      const hasDate = row[0]?.trim(); // Column B (date)
      const hasContent = row.slice(1, 6).some(cell => cell?.trim()); // Columns C through G
      
      if (hasDate && hasContent) {
        console.log(`Row ${index + 1}: Valid row with date and content`);
        return true;
      }
      console.log(`Row ${index + 1}: Skipped - ${hasDate ? 'No content' : 'No date'}`);
      return false;
    })
    .map((row: string[], index: number) => {
      const dateStr = row[0] // Column B
      let title = row[1]?.trim() || '' //Let me help modify the code to sync any date that has text in any of the columns C through G. I'll update the filter condition and the title selection logic.

<lov-code>
Let's update the `sheetsApi.ts` file to implement this logic:

<lov-write file_path="supabase/functions/sync-events/sheetsApi.ts">
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

export function parseSheetRows(rows: string[][], formatting: any[]) {
  return rows
    // Filter rows that have a date AND any content in columns C through G
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
      
      // Get color from formatting data for the current row
      const rowFormat = formatting[index]?.values?.[0]?.userEnteredFormat?.backgroundColor;
      
      console.log(`Processing row ${index + 1}:`, {
        dateStr,
        title,
        rowFormat
      });

      const [dayName, monthName, dayNum] = dateStr.trim().split(' ')
      const month = new Date(`${monthName} 1, 2025`).getMonth()
      const day = parseInt(dayNum)
      
      if (month === 0 && day === 1) {
        console.log(`Skipping January 1st event: ${title} as it's likely a NYE event from previous year`)
        return null
      }

      if (month === 11 && day === 31) {
        console.log(`Processing NYE event: ${title}`)
        return {
          date: '2025-12-31',
          title: title,
          room: room,
          promoter: promoter,
          capacity: capacity,
          status: determineStatus(rowFormat),
          is_recurring: false
        }
      }

      const date = new Date(2025, month, day)
      if (isNaN(date.getTime())) {
        console.warn(`Skipping invalid date in row ${index + 1}:`, dateStr)
        return null
      }

      const status = determineStatus(rowFormat);
      console.log(`Row ${index + 1} status:`, status, 'Color:', rowFormat);

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

function determineStatus(formatting: any) {
  if (!formatting) {
    console.log('No color formatting found, defaulting to pending');
    return 'pending';
  }

  console.log('Raw color values:', formatting);

  // Check for green (confirmed)
  if (formatting.green >= 0.5 && formatting.red < 0.3) {
    console.log('Detected green - Confirmed');
    return 'confirmed';
  }
  
  // Check for yellow/orange (pending)
  if (formatting.red >= 0.5 && formatting.green >= 0.3) {
    console.log('Detected yellow/orange - Pending');
    return 'pending';
  }
  
  // Check for red (cancelled)
  if (formatting.red >= 0.5 && formatting.green < 0.3 && formatting.blue < 0.3) {
    console.log('Detected red - Cancelled');
    return 'cancelled';
  }

  console.log('No specific color match, defaulting to pending');
  return 'pending';
}