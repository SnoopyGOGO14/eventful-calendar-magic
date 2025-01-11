import { useState, useEffect } from 'react';
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
      isRecurring: item.is_recurring
    }));
  };

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });

  return { events, isLoading };
};