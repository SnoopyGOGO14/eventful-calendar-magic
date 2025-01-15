import { parse, format, setYear, isValid } from 'https://esm.sh/date-fns@2.30.0';

// Types
interface Event {
  date: string;
  title: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  room?: string;
  promoter?: string;
  capacity?: string;
  _sheet_line_number?: number;
  is_recurring: boolean;
}

// Constants for date parsing
const DATE_FORMATS = Object.freeze([
  'MMMM d',           // "December 28"
  'MMMM do',          // "December 28th"
  'd MMMM'            // "28 December"
]);

const DAYS_IN_MONTH = Object.freeze({
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
});

// Error types for better error handling
enum DateParsingError {
  INVALID_FORMAT = 'Invalid date format',
  INVALID_MONTH = 'Invalid month',
  INVALID_DAY = 'Invalid day for month',
  FUTURE_DATE = 'Date too far in future',
  PARSE_ERROR = 'Could not parse date'
}

interface DateParsingContext {
  originalDate: string;
  cleanedDate: string;
  sheetYear: string;
  parsedDate?: Date;
  computedYear?: number;
  error?: DateParsingError;
}

// Helper function to clean input strings
function sanitizeDate(input: string): string {
  return input
    .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[,\.]/g, '')
    .replace(/(?:st|nd|rd|th)/i, '')
    .trim();
}

function formatDate(dateStr: string, previousDate: string | null = null, sheetYear: string = '2025'): string {
  const context: DateParsingContext = {
    originalDate: dateStr,
    cleanedDate: '',
    sheetYear
  };

  console.log('Starting date parsing:', context);

  try {
    // If already in YYYY-MM-DD format, return as is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }

    // Clean and sanitize input
    context.cleanedDate = sanitizeDate(dateStr);
    
    // Try each date format until one works
    let parsedDate: Date | null = null;
    
    for (const format of DATE_FORMATS) {
      try {
        const attemptedDate = parse(context.cleanedDate, format, new Date());
        if (isValid(attemptedDate)) {
          parsedDate = attemptedDate;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!parsedDate) {
      throw new Error(DateParsingError.PARSE_ERROR);
    }

    context.parsedDate = parsedDate;

    // Validate days in month
    const month = parsedDate.getMonth() + 1;
    const day = parsedDate.getDate();
    if (day > DAYS_IN_MONTH[month]) {
      throw new Error(DateParsingError.INVALID_DAY);
    }

    // Simplified year handling - use sheet year as base
    let year = parseInt(sheetYear);
    
    // If we're in December and the sheet year is next year, use current year
    if (parsedDate.getMonth() === 11 && year > new Date().getFullYear()) {
      year = year - 1;
    }

    // Set the year and format the date
    const finalDate = setYear(parsedDate, year);
    
    // Validate future dates
    const maxDate = new Date('2026-12-31');
    if (finalDate > maxDate) {
      throw new Error(DateParsingError.FUTURE_DATE);
    }

    context.computedYear = year;
    const formattedDate = format(finalDate, 'yyyy-MM-dd');

    console.log('Date parsing successful:', {
      ...context,
      finalDate: formattedDate
    });

    return formattedDate;

  } catch (error) {
    context.error = error instanceof Error ? error.message as DateParsingError : DateParsingError.PARSE_ERROR;
    console.error('Date parsing failed:', context);
    throw new Error(`Failed to parse date "${dateStr}": ${context.error}`);
  }
}

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data from spreadsheet:', spreadsheetId);
  
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='STUDIO 338 - 2025'!A:F&ranges='STUDIO 338 - 2026'!A:F&includeGridData=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Sheets API error: ${errorText}`);
      throw new Error(`Google Sheets API error: ${errorText}`);
    }

    const data = await response.json();
    console.log('Sheet info:', {
      id: data.spreadsheetId,
      title: data.properties?.title,
      sheets: data.sheets?.map(s => s.properties?.title)
    });
    
    const allValues: string[][] = [];
    const allFormatting: any[] = [];
    
    data.sheets?.forEach(sheet => {
      const gridData = sheet?.data?.[0];
      if (gridData) {
        const yearMatch = sheet.properties?.title.match(/\d{4}/);
        const sheetYear = yearMatch ? yearMatch[0] : '2025';
        
        const values = gridData.rowData?.map(row => {
          const cells = row.values?.map(cell => cell.formattedValue || '');
          cells._sheetYear = sheetYear;
          return cells;
        }) || [];
        
        const formatting = gridData.rowData?.map(row => ({
          values: [{
            userEnteredFormat: {
              backgroundColor: row.values?.[0]?.userEnteredFormat?.backgroundColor
            }
          }]
        })) || [];
        
        allValues.push(...values);
        allFormatting.push(...formatting);
      }
    });
    
    if (!allValues.length) {
      throw new Error('No data found in sheets');
    }
    
    console.log(`Found total ${allValues.length} rows of data`);
    return { values: allValues, formatting: allFormatting };
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

export function parseSheetRows(values: string[][], formatting: any[] = []): Event[] {
  console.log('Starting to parse sheet rows...');
  console.log(`Number of rows: ${values?.length || 0}`);

  if (!values?.length) {
    console.log('No values found in sheet');
    return [];
  }

  let previousDate: string | null = null;
  const events = values.slice(1).map((row, index) => {
    if (!row || row.length < 1 || !row.some(cell => cell?.trim())) {
      console.log(`Skipping empty row at index ${index + 1}`);
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    
    if (!date?.trim() || !title?.trim()) {
      console.log(`Skipping row ${index + 1}: missing date or title`);
      return null;
    }
    
    try {
      const formattedDate = formatDate(date.trim(), previousDate, row._sheetYear);
      previousDate = formattedDate;
      
      const rowFormatting = formatting[index + 1];
      const backgroundColor = rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor;
      
      // Determine status based on background color
      let status: 'confirmed' | 'pending' | 'cancelled' = 'pending';
      
      if (backgroundColor) {
        const { red, green, blue } = backgroundColor;
        const rgbStr = `rgb(${Math.round(red * 255)},${Math.round(green * 255)},${Math.round(blue * 255)})`;
        
        // Match colors with some tolerance
        if (Math.abs(red * 255 - 67) < 10 && Math.abs(green * 255 - 160) < 10 && Math.abs(blue * 255 - 71) < 10) {
          status = 'confirmed';
        } else if (Math.abs(red * 255 - 234) < 10 && Math.abs(green * 255 - 67) < 10 && Math.abs(blue * 255 - 53) < 10) {
          status = 'cancelled';
        }
        
        console.log(`Color match for row ${index + 2}:`, { rgbStr, status });
      }

      console.log(`Row ${index + 2}: Processed`, {
        date: formattedDate,
        title: title.trim(),
        status
      });

      return {
        date: formattedDate,
        title: title.trim(),
        status,
        room: room?.trim() || '',
        promoter: promoter?.trim() || '',
        capacity: capacity?.trim() || '',
        _sheet_line_number: index + 2,
        is_recurring: false
      };
    } catch (error) {
      console.error(`Error processing row ${index + 2}:`, error);
      return null;
    }
  }).filter(Boolean);

  console.log(`Successfully parsed ${events.length} events`);
  return events;
}
