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

interface RGBColor {
  red: number;
  green: number;
  blue: number;
}

interface ColorMatchResult {
  status: Event['status'];
  confidence: number;  // 0-1, where 1 is exact match
  method: 'exact' | 'tolerance' | 'range' | 'fallback';
}

interface ColorReference {
  rgb: RGBColor;
  hex: string;
  ranges: {
    red: { min: number; max: number };
    green: { min: number; max: number };
    blue: { min: number; max: number };
  };
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

const STATUS_COLORS: Record<Event['status'] | 'pendingAlt', ColorReference> = {
  confirmed: {
    rgb: { red: 147, green: 196, blue: 125 },  // #93c47d
    hex: '#93c47d',
    ranges: {
      red: { min: 130, max: 160 },
      green: { min: 180, max: 210 },
      blue: { min: 110, max: 140 }
    }
  },
  cancelled: {
    rgb: { red: 224, green: 102, blue: 102 },  // #e06666
    hex: '#e06666',
    ranges: {
      red: { min: 210, max: 240 },
      green: { min: 90, max: 120 },
      blue: { min: 90, max: 120 }
    }
  },
  pending: {
    rgb: { red: 255, green: 217, blue: 102 },  // #ffd966
    hex: '#ffd966',
    ranges: {
      red: { min: 240, max: 255 },
      green: { min: 200, max: 230 },
      blue: { min: 90, max: 120 }
    }
  },
  pendingAlt: {
    rgb: { red: 255, green: 153, blue: 0 },    // #ff9900
    hex: '#ff9900',
    ranges: {
      red: { min: 240, max: 255 },
      green: { min: 140, max: 170 },
      blue: { min: 0, max: 20 }
    }
  }
};

function normalizeColor(color: any): RGBColor | null {
  try {
    if (color && typeof color.red === 'number' && color.red <= 1) {
      return {
        red: Math.round(color.red * 255),
        green: Math.round(color.green * 255),
        blue: Math.round(color.blue * 255)
      };
    }
    
    if (color && typeof color.red === 'number' && color.red > 1) {
      return {
        red: Math.round(color.red),
        green: Math.round(color.green),
        blue: Math.round(color.blue)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Color normalization failed:', error);
    return null;
  }
}

function colorToHex(color: RGBColor): string {
  return `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`.toLowerCase();
}

function getColorDistance(color1: RGBColor, color2: RGBColor): number {
  return Math.sqrt(
    Math.pow(color1.red - color2.red, 2) +
    Math.pow(color1.green - color2.green, 2) +
    Math.pow(color1.blue - color2.blue, 2)
  );
}

function isInColorRange(color: RGBColor, ranges: ColorReference['ranges']): boolean {
  return (
    color.red >= ranges.red.min && color.red <= ranges.red.max &&
    color.green >= ranges.green.min && color.green <= ranges.green.max &&
    color.blue >= ranges.blue.min && color.blue <= ranges.blue.max
  );
}

function matchColor(color: RGBColor): ColorMatchResult {
  const TOLERANCE = 10;
  const matches: ColorMatchResult[] = [];

  // Log the color being matched
  console.log('Matching color:', {
    rgb: `${color.red},${color.green},${color.blue}`,
    hex: colorToHex(color)
  });

  // Try exact matches with tolerance
  Object.entries(STATUS_COLORS).forEach(([key, reference]) => {
    const distance = getColorDistance(color, reference.rgb);
    const confidence = Math.max(0, 1 - (distance / (TOLERANCE * 3)));
    
    if (distance <= TOLERANCE) {
      matches.push({
        status: key === 'pendingAlt' ? 'pending' : key as Event['status'],
        confidence,
        method: distance === 0 ? 'exact' : 'tolerance'
      });
    }
  });

  // If we found matches within tolerance, return the best one
  if (matches.length > 0) {
    const bestMatch = matches.reduce((a, b) => a.confidence > b.confidence ? a : b);
    console.log('Found match within tolerance:', bestMatch);
    return bestMatch;
  }

  // Try range-based matching
  for (const [key, reference] of Object.entries(STATUS_COLORS)) {
    if (isInColorRange(color, reference.ranges)) {
      const result = {
        status: key === 'pendingAlt' ? 'pending' : key as Event['status'],
        confidence: 0.7,
        method: 'range'
      };
      console.log('Found match within ranges:', result);
      return result;
    }
  }

  // Fallback to basic RGB analysis
  const { red, green, blue } = color;
  if (green > 140 && green > red && green > blue) {
    return { status: 'confirmed', confidence: 0.5, method: 'fallback' };
  }
  if (red > 200 && red > green && red > blue) {
    return { status: 'cancelled', confidence: 0.5, method: 'fallback' };
  }
  if (red > 200 && green > 140 && blue < 120) {
    return { status: 'pending', confidence: 0.5, method: 'fallback' };
  }

  // Ultimate fallback
  return { status: 'pending', confidence: 0, method: 'fallback' };
}

function determineStatusFromColor(rowFormatting: any): Event['status'] {
  try {
    const backgroundColor = rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor;
    if (!backgroundColor) {
      console.log('No background color found in formatting');
      return 'pending';
    }

    const normalizedColor = normalizeColor(backgroundColor);
    if (!normalizedColor) {
      console.log('Color normalization failed');
      return 'pending';
    }

    console.log('Normalized color:', {
      raw: backgroundColor,
      normalized: normalizedColor,
      hex: colorToHex(normalizedColor)
    });

    const result = matchColor(normalizedColor);
    console.log('Color match result:', {
      status: result.status,
      confidence: result.confidence,
      method: result.method
    });

    return result.status;

  } catch (error) {
    console.error('Error determining color status:', error);
    return 'pending';
  }
}

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data from spreadsheet:', spreadsheetId);
  
  try {
    // Update the range to properly format the sheet name with single quotes
    const sheetName = "'338 Cal Copy'";
    const range = encodeURIComponent(`${sheetName}!A:F`);
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${range}&includeGridData=true`,
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
      const status = determineStatusFromColor(rowFormatting);
      
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
