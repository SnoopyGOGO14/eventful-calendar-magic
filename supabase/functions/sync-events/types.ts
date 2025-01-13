// Event status types and color mappings
export type EventStatus = 'confirmed' | 'pending' | 'cancelled';

// Single source of truth for spreadsheet colors
export const SPREADSHEET_CELL_COLORS: Record<string, EventStatus> = {
  // Cell color -> Status word
  'rgb(67, 160, 71)': 'confirmed',    // Google Sheets green
  'rgb(67,160,71)': 'confirmed',      // Alternative format
  '#43A047': 'confirmed',             // Hex format
  'rgb(255, 217, 102)': 'pending',    // Google Sheets yellow
  'rgb(255,217,102)': 'pending',      // Alternative format
  '#FFD966': 'pending',               // Hex format
  'rgb(244, 67, 54)': 'cancelled',    // Google Sheets red
  'rgb(244,67,54)': 'cancelled',      // Alternative format
  '#F44336': 'cancelled',             // Hex format
  // Add more variations of the same colors
  'rgb(60, 160, 70)': 'confirmed',    // Slight variation of green
  'rgb(70, 160, 75)': 'confirmed',    // Another variation
  'rgb(250, 215, 100)': 'pending',    // Slight variation of yellow
  'rgb(240, 65, 50)': 'cancelled'     // Slight variation of red
};