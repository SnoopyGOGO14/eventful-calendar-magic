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

  // Then fetch the formatting
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!B:I&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`,
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
    formatting: formatting.sheets?.[0]?.data?.[0]?.rowData || []
  };
}

export function parseSheetRows(rows: string[][], formatting: any[]) {
  return rows
    .filter((row: string[], index: number) => row[0] && row[1])
    .map((row: string[], index: number) => {
      const dateStr = row[0] // Column B
      const title = row[1] || '' // Column C
      const room = row[2] || '' // Column D
      const promoter = row[3] || '' // Column E
      const capacity = row[4] || '' // Column F
      const contractStatus = (row[7] || '').toLowerCase() // Column I

      // Get background color from formatting
      const rowFormatting = formatting[index]?.values?.[1]?.userEnteredFormat?.backgroundColor;
      console.log(`Row ${index} formatting for ${dateStr}:`, rowFormatting);

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
          status: determineStatus(contractStatus, rowFormatting),
          is_recurring: false
        }
      }

      const date = new Date(2025, month, day)
      if (isNaN(date.getTime())) {
        console.warn(`Skipping invalid date in row ${index + 1}:`, dateStr)
        return null
      }

      return {
        date: date.toISOString().split('T')[0],
        title: title,
        room: room,
        promoter: promoter,
        capacity: capacity,
        status: determineStatus(contractStatus, rowFormatting),
        is_recurring: false
      }
    })
    .filter(event => event !== null)
}

function determineStatus(contractStatus: string, formatting: any) {
  // If there's explicit formatting, use it
  if (formatting) {
    // Check for green background (common Google Sheets green values)
    if (
      (formatting.green > 0.8) || // Bright green
      (formatting.green > 0.6 && formatting.red < 0.3) || // Dark green
      (formatting.green === 1 && formatting.red === 0.8509804) // Light green
    ) {
      console.log('Found green background, setting status to confirmed');
      return 'confirmed';
    }
    
    // Check for yellow background
    if (formatting.red > 0.8 && formatting.green > 0.8 && formatting.blue < 0.3) {
      console.log('Found yellow background, setting status to pending');
      return 'pending';
    }
    
    // Check for red background
    if (formatting.red > 0.8 && formatting.green < 0.3) {
      console.log('Found red background, setting status to cancelled');
      return 'cancelled';
    }
  }
  
  // Fall back to the contract status text
  console.log('No color formatting found, using contract status:', contractStatus);
  return contractStatus === 'yes' ? 'confirmed' : 'pending';
}