import { Event } from '@/components/Calendar/Calendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const useCalendarData = () => {
  const fetchEvents = async () => {
    console.log('Starting to fetch events...');
    
    // First, verify the table exists and we can access it
    const { data: tableInfo, error: tableError } = await supabase
      .from('events')
      .select('count');
    
    if (tableError) {
      console.error('Error accessing events table:', tableError);
      throw tableError;
    }
    
    console.log('Successfully connected to events table');
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      throw error;
    }

    console.log('Raw database response:', data);
    console.log(`Found ${data?.length || 0} events in database`);
    
    if (!data || data.length === 0) {
      console.log('No events found in database - verify if this is expected');
      return [];
    }

    const events = (data || []).map(item => {
      console.log('Processing event:', item);
      return {
        date: item.date,
        title: item.title,
        status: (item.status as "confirmed" | "pending" | "cancelled") || "pending",
        isRecurring: item.is_recurring,
        room: item.room,
        promoter: item.promoter,
        capacity: item.capacity
      };
    });

    console.log('Processed events:', events);
    return events;
  };

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    initialData: [] as Event[],
    staleTime: 0,
    gcTime: 0,
  });

  if (error) {
    console.error('Query error:', error);
  }

  return { events, isLoading, error };
};