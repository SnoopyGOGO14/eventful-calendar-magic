# Calendar Date Handling Documentation

## Current Implementation (as of latest update)

### Year Transition Logic
The calendar processes dates from a Google Sheet with the following rules:

1. Starting Point: December 2024
2. Main Calendar Year: 2025
3. Year Transition Rules:
   - Calendar starts processing from December 2024
   - When encountering a month that's earlier than the last processed month, the year increments
   - Example: After December 2024 → January 2025
   - Example: After December 2025 → January 2026

### Implementation Details (in sheetsApi.ts)
```typescript
let currentYear = 2024; // Starts with December 2024
let lastMonth = 11;     // December is month 11 (0-based)

// When processing dates:
if (month < lastMonth) {
  currentYear++;
}
lastMonth = month;
```

### Important Notes
- The spreadsheet name is 'STUDIO 338 - 2025'
- Events are stored in Supabase 'events' table with proper date formatting
- Date format in database: ISO string (YYYY-MM-DD)
- Events sync from Google Sheets maintains chronological order
- Current spreadsheet ID: '18KbXdfe2EfjtP3YahNRs1uJauMoK0yZsJCwzeCBu1kc'

### Common Pitfalls to Avoid
1. Don't assume January dates always belong to 2025
2. Remember that month numbers are 0-based in JavaScript Date objects
3. Always check the month transition logic when processing dates sequentially

### Testing Calendar Sync
1. Sync button in UI triggers the sync-events Edge Function
2. Check Edge Function logs for date processing details
3. Verify dates appear in correct chronological order in calendar