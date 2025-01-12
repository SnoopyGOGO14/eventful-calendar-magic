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
  '#00ff00': 'confirmed',  // Green cell = Confirmed (Warner Bros)
  '#ffd966': 'pending',    // Yellow cell = Pending (Ukrainian)
  '#ff0000': 'cancelled'   // Red cell = Cancelled
} as const;
