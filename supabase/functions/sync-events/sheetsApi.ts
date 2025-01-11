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

  // Fetch cell formatting with specific focus on background colors
  const formattingResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!G:G&fields=sheets.data.rowData.values.effectiveFormat.backgroundColor,sheets.data.rowData.values.userEnteredFormat.backgroundColor,sheets.data.rowData.values.effectiveFormat.backgroundColorStyle`,
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

function getThemeColor(colorStyle: any): string {
  if (!colorStyle?.themeColor) return '';
  
  // Map theme colors to status
  const themeColorMap: Record<string, string> = {
    'ACCENT1': 'confirmed',  // Green
    'ACCENT2': 'pending',    // Yellow
    'ACCENT3': 'cancelled'   // Red
  };
  
  return themeColorMap[colorStyle.themeColor] || '';
}

function getRgbColor(color: any): string {
  if (!color) return '';
  
  const { red = 0, green = 0, blue = 0 } = color;
  
  // Check for specific Google Sheets default color combinations
  if (green > 0.6 && red < 0.4 && blue < 0.4) return 'confirmed';  // Green
  if (red > 0.9 && green > 0.8 && blue < 0.4) return 'pending';    // Yellow
  if (red > 0.8 && green < 0.3 && blue < 0.3) return 'cancelled';  // Red
  
  return '';
}

function determineStatusFromColor(bgColor: any, rowNumber: number, dateStr: string) {
  if (!bgColor) {
    console.log(`Row ${rowNumber} (${dateStr}): No background color found, defaulting to pending`);
    return 'pending';
  }

  // Try to get the color from different possible formats
  const effectiveFormat = bgColor?.effectiveFormat;
  const userFormat = bgColor?.userEnteredFormat;

  console.log(`Row ${rowNumber} (${dateStr}) - Analyzing color formats:`, {
    effectiveFormat,
    userFormat
  });

  // First try theme colors (most reliable)
  const themeStatus = getThemeColor(effectiveFormat?.backgroundColorStyle || userFormat?.backgroundColorStyle);
  if (themeStatus) {
    console.log(`Row ${rowNumber} (${dateStr}): Theme color detected → ${themeStatus}`);
    return themeStatus;
  }

  // Then try RGB values
  const rgbStatus = getRgbColor(effectiveFormat?.backgroundColor || userFormat?.backgroundColor);
  if (rgbStatus) {
    console.log(`Row ${rowNumber} (${dateStr}): RGB color detected → ${rgbStatus}`);
    return rgbStatus;
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