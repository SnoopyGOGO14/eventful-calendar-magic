import { Event } from '@/components/Calendar/Calendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const useCalendarData = () => {
  const fetchEvents = async () => {
    console.log('Fetching events from database...');
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} events in database`);
    
    const events = (data || []).map(item => ({
      date: item.date,
      title: item.title,
      status: (item.status as "confirmed" | "pending" | "cancelled") || "pending",
      isRecurring: item.is_recurring,
      room: item.room,
      promoter: item.promoter,
      capacity: item.capacity
    }));

    console.log('Processed events:', events);
    return events;
  };

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    initialData: [] as Event[], // Properly type the initial data
    staleTime: 0, // Consider data immediately stale to force refresh after sync
    gcTime: 0, // Replace cacheTime with gcTime
  });

  return { events, isLoading, error };
};