import { supabase } from '@/integrations/supabase/client';

async function checkDatabase() {
  console.log('Checking all events in database...');
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('All events in database:', data);
  
  // Check specifically for January 1st entries
  const janFirstEvents = data.filter(event => event.date.startsWith('2025-01-01'));
  console.log('\nJanuary 1st events:', janFirstEvents);
  
  // Check for test entries (negative line numbers)
  const testEvents = data.filter(event => event._sheet_line_number < 0);
  console.log('\nTest events (negative line numbers):', testEvents);
}

checkDatabase();
