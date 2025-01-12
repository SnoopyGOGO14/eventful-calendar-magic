import { supabase } from '@/integrations/supabase/client';

async function cleanDatabase() {
  console.log('Cleaning database...');
  
  // Remove all test events (negative line numbers)
  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .lt('_sheet_line_number', 0);

  if (deleteError) {
    console.error('Error cleaning up:', deleteError.message);
    return;
  }

  console.log('Successfully removed all test events');
}

cleanDatabase();
