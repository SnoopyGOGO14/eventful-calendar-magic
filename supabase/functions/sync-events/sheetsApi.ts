import { EventStatus, SPREADSHEET_CELL_COLORS } from './types.ts';

// Types for API responses
interface SheetData {
  values: string[][];
  formatting: any[];
}

interface Event {
  date: string;
  title: string;
  status: EventStatus;
  room?: string;
  promoter?: string;
  capacity?: string;
  _sheet_line_number: number;
  is_recurring: boolean;
}

function formatDate(dateStr: string, previousDate: string | null = null): string {
  console.log('Formatting date:', dateStr, 'Previous date:', previousDate);
  
  // If the date is already in YYYY-MM-DD format, return it as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  try {
    // Remove any day names and extra spaces
    const cleanDate = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '').trim();
    
    // Default to 2025
    let year = 2025;
    
    // If we have a previous date, check if we need to increment the year
    if (previousDate) {
      const prevDate = new Date(previousDate);
      const currentDate = new Date(`${cleanDate}, 2025`); // Temporarily use 2025
      
      // If this date is earlier in the year than the previous date, it must be next year
      if (currentDate.getMonth() < prevDate.getMonth() || 
          (currentDate.getMonth() === prevDate.getMonth() && currentDate.getDate() < prevDate.getDate())) {
        year = 2026;
        console.log(`Date ${cleanDate} is earlier than previous date ${previousDate}, using year ${year}`);
      }
    }
    
    // Parse the date with the determined year
    const date = new Date(`${cleanDate}, ${year}`);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Format as YYYY-MM-DD
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    console.log(`Formatted date: ${dateStr} -> ${formattedDate}`);
    return formattedDate;
  } catch (error) {
    console.error(`Error parsing date "${dateStr}":`, error);
    throw new Error(`Invalid date format: ${dateStr}`);
  }
}

export async function fetchSheetData(spreadsheetId: string, accessToken: string): Promise<SheetData> {
  console.log('Starting to fetch sheet data from spreadsheet:', spreadsheetId);
  
  // Fetch data from both 2025 and 2026 sheets
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
  
  // Process both sheets
  const allValues: string[][] = [];
  const allFormatting: any[] = [];
  
  data.sheets?.forEach(sheet => {
    const gridData = sheet?.data?.[0];
    if (gridData) {
      // Extract year from sheet name
      const yearMatch = sheet.properties?.title.match(/\d{4}/);
      const sheetYear = yearMatch ? yearMatch[0] : '2025';
      
      // Convert the grid data into our format
      const values = gridData.rowData?.map(row => {
        const cells = row.values?.map(cell => cell.formattedValue || '');
        // Add the sheet year as metadata
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
}

// Color Types and Interfaces
type EventStatus = 'confirmed' | 'cancelled' | 'pending';

interface RGBColor {
  red: number;
  green: number;
  blue: number;
}

interface ColorMatchResult {
  status: EventStatus;
  confidence: number;  // 0-1, where 1 is exact match
  method: 'exact' | 'tolerance' | 'range' | 'fallback';
}

// Reference colors with multiple formats
const STATUS_COLORS = {
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
} as const;

// Color Utility Functions
function normalizeColor(color: any): RGBColor | null {
  try {
    // Handle Google Sheets 0-1 format
    if (color && typeof color.red === 'number' && color.red <= 1) {
      return {
        red: Math.round(color.red * 255),
        green: Math.round(color.green * 255),
        blue: Math.round(color.blue * 255)
      };
    }
    
    // Handle direct RGB values
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

function isInColorRange(color: RGBColor, ranges: typeof STATUS_COLORS[keyof typeof STATUS_COLORS]['ranges']): boolean {
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
        status: key === 'pendingAlt' ? 'pending' : key as EventStatus,
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
        status: key === 'pendingAlt' ? 'pending' : key as EventStatus,
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

function determineStatusFromColor(rowFormatting: any): EventStatus {
  try {
    // Extract and validate color from formatting
    const backgroundColor = rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor;
    if (!backgroundColor) {
      console.log('No background color found in formatting');
      return 'pending';
    }

    // Normalize the color
    const normalizedColor = normalizeColor(backgroundColor);
    if (!normalizedColor) {
      console.log('Color normalization failed');
      return 'pending';
    }

    // Log the normalized color
    console.log('Normalized color:', {
      raw: backgroundColor,
      normalized: normalizedColor,
      hex: colorToHex(normalizedColor)
    });

    // Match the color and get the status
    const result = matchColor(normalizedColor);
    
    // Log the matching result
    console.log('Color match result:', {
      status: result.status,
      confidence: result.confidence,
      method: result.method
    });

    return result.status;
  } catch (error) {
    console.error('Error in color status determination:', error);
    return 'pending';
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
    // Skip completely empty rows
    if (!row || row.length < 1 || !row.some(cell => cell?.trim())) {
      console.log(`Skipping empty row at index ${index + 1}`);
      return null;
    }

    const [date, title, room, promoter, capacity] = row;
    
    // Skip if no date or title
    if (!date?.trim() || !title?.trim()) {
      console.log(`Skipping row ${index + 1}: missing date or title`);
      return null;
    }
    
    try {
      // Pass the previous date to determine if we need to increment the year
      const formattedDate = formatDate(date.trim(), previousDate);
      previousDate = formattedDate; // Store this date for next iteration
      
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