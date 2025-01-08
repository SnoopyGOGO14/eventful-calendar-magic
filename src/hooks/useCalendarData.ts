import { useState, useEffect } from 'react';
import { Event } from '@/components/Calendar/Calendar';

// This is a mock implementation. Replace with actual Google Sheets API integration
export const useCalendarData = () => {
  const [events, setEvents] = useState<(Event & { date: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock data - replace with actual Google Sheets API call
    const mockEvents = [
      {
        date: '2024-01-15',
        title: 'LOVE JUICE',
        status: 'confirmed',
        isRecurring: true,
      },
      {
        date: '2024-01-22',
        title: 'RELEASE',
        status: 'pending',
        isRecurring: false,
      },
    ];

    setEvents(mockEvents as (Event & { date: string })[]);
    setIsLoading(false);
  }, []);

  return { events, isLoading };
};