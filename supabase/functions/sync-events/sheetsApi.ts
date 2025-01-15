import { ColorService } from './services/colorService';
import { SyncService } from './services/syncService';
import { Event } from './types';

const colorService = new ColorService();
const syncService = new SyncService();

export async function fetchSheetData(spreadsheetId: string, accessToken: string) {
  console.log('Starting to fetch sheet data from spreadsheet:', spreadsheetId);
  syncService.startSession();
  
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
    syncService.addError(error as Error);
    throw error;
  } finally {
    syncService.endSession();
    console.log('Sync metrics:', syncService.getSessionMetrics());
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
      const formattedDate = formatDate(date.trim(), previousDate);
      previousDate = formattedDate;
      
      const rowFormatting = formatting[index + 1];
      const colorMatchLog = colorService.createMatchLog(
        rowFormatting?.values?.[0]?.userEnteredFormat?.backgroundColor
      );
      
      syncService.addColorMatch(colorMatchLog);
      
      console.log(`Row ${index + 2}: Processed`, {
        date: formattedDate,
        title: title.trim(),
        status: colorMatchLog.finalResult.status
      });

      return {
        date: formattedDate,
        title: title.trim(),
        status: colorMatchLog.finalResult.status,
        room: room?.trim() || '',
        promoter: promoter?.trim() || '',
        capacity: capacity?.trim() || '',
        _sheet_line_number: index + 2,
        is_recurring: false
      };
    } catch (error) {
      console.error(`Error processing row ${index + 2}:`, error);
      syncService.addError(error as Error);
      return null;
    }
  }).filter(Boolean);

  console.log(`Successfully parsed ${events.length} events`);
  return events;
}

// Helper function to format dates
function formatDate(dateStr: string, previousDate: string | null = null): string {
  console.log('Formatting date:', dateStr, 'Previous date:', previousDate);
  
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  try {
    const cleanDate = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '').trim();
    let year = 2025;
    
    if (previousDate) {
      const prevDate = new Date(previousDate);
      const currentDate = new Date(`${cleanDate}, 2025`);
      
      if (currentDate.getMonth() < prevDate.getMonth() || 
          (currentDate.getMonth() === prevDate.getMonth() && currentDate.getDate() < prevDate.getDate())) {
        year = 2026;
        console.log(`Date ${cleanDate} is earlier than previous date ${previousDate}, using year ${year}`);
      }
    }
    
    const date = new Date(`${cleanDate}, ${year}`);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
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