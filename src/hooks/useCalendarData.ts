import { Event } from '@/components/Calendar/Calendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const isValidEvent = (item: any): boolean => {
  if (!item?.date || !item?.title) {
    console.warn('Invalid event data - missing required fields:', item);
    return false;
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(item.date)) {
    console.warn('Invalid date format:', item.date);
    return false;
  }

  // Validate status
  const validStatuses = ['confirmed', 'pending', 'cancelled'];
  if (item.status && !validStatuses.includes(item.status)) {
    console.warn('Invalid status:', item.status);
    return false;
  }

  return true;
};

export const useCalendarData = () => {
  const fetchEvents = async () => {
    console.log('Starting to fetch events...');
    
    try {
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

      const events = (data || [])
        .filter(isValidEvent)
        .map(item => {
          console.log('Processing valid event:', item);
          return {
            date: item.date,
            title: item.title,
            status: (item.status || 'pending') as Event['status'],
            isRecurring: !!item.is_recurring,
            room: item.room || '',
            promoter: item.promoter || '',
            capacity: item.capacity || ''
          };
        });

      console.log(`Successfully processed ${events.length} valid events`);
      return events;

    } catch (error) {
      console.error('Error in fetchEvents:', error);
      throw error;
    }
  };

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  if (error) {
    console.error('Query error:', error);
  }

  return { events, isLoading, error };
};