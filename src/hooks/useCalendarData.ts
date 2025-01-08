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

        setEvents(data || []);
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