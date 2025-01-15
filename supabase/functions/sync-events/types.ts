// Event status types and color mappings
export type EventStatus = 'confirmed' | 'pending' | 'cancelled';

// Single source of truth for spreadsheet colors
export const SPREADSHEET_CELL_COLORS: Record<string, EventStatus> = {
  // Cell color -> Status word
  'rgb(67, 160, 71)': 'confirmed',    // Google Sheets green
  'rgb(67,160,71)': 'confirmed',      // Alternative format
  '#43A047': 'confirmed',             // Hex format
  'rgb(255, 153, 0)': 'pending',      // Google Sheets orange
  'rgb(255,153,0)': 'pending',        // Alternative format
  '#FF9900': 'pending',               // Hex format
  'rgb(234, 67, 53)': 'cancelled',    // Google Sheets red
  'rgb(234,67,53)': 'cancelled',      // Alternative format
  '#EA4335': 'cancelled',             // Hex format
  // Add variations for better matching
  'rgb(60, 160, 70)': 'confirmed',    // Slight variation of green
  'rgb(70, 160, 75)': 'confirmed',    // Another variation
  'rgb(250, 150, 0)': 'pending',      // Slight variation of orange
  'rgb(230, 65, 50)': 'cancelled'     // Slight variation of red
};