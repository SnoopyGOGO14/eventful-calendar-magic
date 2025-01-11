import React, { useState } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { NoteModal } from './NoteModal';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { useCalendarData } from '@/hooks/useCalendarData';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { syncEvents } from '@/utils/syncEvents';
import { useQueryClient } from '@tanstack/react-query';

export interface Event {
  date: string;
  title: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  isRecurring: boolean;
  room?: string;
  promoter?: string;
  capacity?: string;
}

export const Calendar = () => {
  // Initialize with January 2026 as the default date
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const { events = [], isLoading } = useCalendarData();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncEvents('18KbXdfe2EfjtP3YahNRs1uJauMoK0yZsJCwzeCBu1kc');
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Calendar synced successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync calendar. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="min-h-screen bg-[#1B3A4B] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <CalendarHeader 
            currentDate={currentDate} 
            onDateChange={setCurrentDate}
          />
          <Button 
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="bg-green-500 hover:bg-green-600"
          >
            {isSyncing ? 'Syncing...' : 'Sync Calendar'}
          </Button>
        </div>

        <CalendarGrid
          days={days}
          currentDate={currentDate}
          events={events}
          onSelectDate={setSelectedDate}
          isLoading={isLoading}
        />

        {selectedDate && (
          <NoteModal
            date={selectedDate}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>
    </div>
  );
};