// Event status types and color mappings
export type EventStatus = 'confirmed' | 'pending' | 'cancelled';

// Single source of truth for status colors
export const STATUS_COLORS = {
  // Status word -> UI color band
  confirmed: 'bg-green-500',
  pending: 'bg-yellow-500',
  cancelled: 'bg-red-500'
} as const;

// Single source of truth for spreadsheet colors
export const SPREADSHEET_CELL_COLORS = {
  // Cell color -> Status word
  'rgb(67,160,71)': 'confirmed',    // Google Sheets green
  'rgb(255,217,102)': 'pending',    // Google Sheets yellow
  'rgb(244,67,54)': 'cancelled'     // Google Sheets red
} as const;
