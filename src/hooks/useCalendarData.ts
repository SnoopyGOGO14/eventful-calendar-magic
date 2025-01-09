import { useState, useEffect } from 'react';
import { Event } from '@/components/Calendar/Calendar';
import { supabase } from '@/integrations/supabase/client';

export const useCalendarData = () => {
  const [events, setEvents] = useState<(Event & { date: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*');

        if (error) {
          console.error('Error fetching events:', error);
          return;
        }

        // Transform the data to match the Event type
        const transformedData = (data || []).map(item => ({
          date: item.date,
          title: item.title,
          status: item.status,
          isRecurring: item.is_recurring // Map is_recurring to isRecurring
        }));

        setEvents(transformedData);
      } catch (error) {
        console.error('Error in fetchEvents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return { events, isLoading };
};