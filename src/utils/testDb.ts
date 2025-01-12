import { supabase } from '@/integrations/supabase/client';

async function testEventsTable() {
  console.log('Testing events table...');
  
  // First, let's update the test event
  const { error: updateError } = await supabase
    .from('events')
    .update({ 
      date: '2025-01-15',
      title: 'Updated Test Event',
      status: 'confirmed',
      room: 'Main Room',
      promoter: 'Test Promoter',
      capacity: '500'
    })
    .eq('_sheet_line_number', -1);

  if (updateError) {
    console.error('Error updating:', updateError.message);
    return;
  }

  // Now let's add two more test events
  const { error: insertError } = await supabase
    .from('events')
    .insert([
      {
        date: '2025-01-20',
        title: 'Pending Event',
        status: 'pending',
        room: 'Studio',
        promoter: 'New Promoter',
        capacity: '200',
        _sheet_line_number: -2
      },
      {
        date: '2025-01-25',
        title: 'Cancelled Event',
        status: 'cancelled',
        room: 'Terrace',
        promoter: 'Another Promoter',
        capacity: '300',
        _sheet_line_number: -3
      }
    ]);

  if (insertError) {
    console.error('Error inserting:', insertError.message);
    return;
  }

  // Finally, let's fetch all test events
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .lt('_sheet_line_number', 0)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching:', error.message);
    return;
  }

  console.log('Success! Current test data:', data);
}

testEventsTable();
