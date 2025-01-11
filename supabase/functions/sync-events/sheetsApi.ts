export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:I`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${await response.text()}`)
  }

  return await response.json()
}

export function parseSheetRows(rows: string[][]) {
  return rows
    .filter((row: string[]) => row[0] && row[1])
    .map((row: string[], index: number) => {
      const dateStr = row[0] // Column B
      const title = row[1] || '' // Column C
      const contractStatus = (row[7] || '').toLowerCase() // Column I

      const [dayName, monthName, dayNum] = dateStr.trim().split(' ')
      const month = new Date(`${monthName} 1, 2025`).getMonth()
      const day = parseInt(dayNum)
      
      // Skip creating events for January 1st as they're likely NYE events from previous year
      if (month === 0 && day === 1) {
        console.log(`Skipping January 1st event: ${title} as it's likely a NYE event from previous year`)
        return null
      }

      // Handle NYE events
      if (month === 11 && day === 31) {
        console.log(`Processing NYE event: ${title}`)
        return {
          date: '2025-12-31',
          title: title,
          status: contractStatus === 'yes' ? 'confirmed' : 'pending',
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
        status: contractStatus === 'yes' ? 'confirmed' : 'pending',
        is_recurring: false
      }
    })
    .filter(event => event !== null)
}