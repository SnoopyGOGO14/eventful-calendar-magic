// Event status types and color mappings
export type EventStatus = 'confirmed' | 'pending' | 'cancelled';

// UI color mapping
export const STATUS_COLORS = {
  confirmed: 'bg-green-500',  // #43a047
  pending: 'bg-orange-500',   // #ff9900
  cancelled: 'bg-red-500'     // #ea4335
} as const;

// Google Sheets color mapping
export const SPREADSHEET_CELL_COLORS = {
  'rgb(67,160,71)': 'confirmed',    // Google Sheets green
  'rgb(255,153,0)': 'pending',      // Google Sheets orange
  'rgb(234,67,53)': 'cancelled'     // Google Sheets red
} as const;
