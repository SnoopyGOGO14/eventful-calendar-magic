import { Event } from '@/components/Calendar/Calendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const useCalendarData = () => {
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*');

    if (error) {
      console.error('Error fetching events:', error);
      throw error;
    }

    return (data || []).map(item => ({
      date: item.date,
      title: item.title,
      status: (item.status as "confirmed" | "pending" | "cancelled") || "pending",
      isRecurring: item.is_recurring,
      room: item.room,
      promoter: item.promoter,
      capacity: item.capacity
    }));
  };

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    initialData: [], // Provide empty array as initial data
  });

  return { events, isLoading, error };
};