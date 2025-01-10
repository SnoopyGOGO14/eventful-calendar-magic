import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { AnimatedBrandName } from './AnimatedBrandName';
import { NoteModal } from './NoteModal';
import { CalendarHeader } from './CalendarHeader';
import { useCalendarData } from '@/hooks/useCalendarData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { syncEvents } from '@/utils/syncEvents';

export interface Event {
  title: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  isRecurring: boolean;
}

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { events, isLoading } = useCalendarData();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncEvents('10HjBOsJemFkmRbu-EGG0BnFUKAh0FMhPWsvjuSlGokw');
      toast.success('Calendar synced successfully!');
    } catch (error) {
      toast.error('Failed to sync calendar. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventForDate = (date: Date): Event | undefined => {
    return events?.find(event => 
      format(new Date(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  const getBackgroundColor = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-[#F2FCE2]';
      case 'pending':
        return 'bg-[#FEC6A1]';
      case 'cancelled':
        return 'bg-[#ea384c]';
      default:
        return 'bg-transparent';
    }
  };

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
            disabled={isSyncing}
            className="bg-green-500 hover:bg-green-600"
          >
            {isSyncing ? 'Syncing...' : 'Sync Calendar'}
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mt-4">
          {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => (
            <div 
              key={day} 
              className="p-2 text-white font-bold text-center border-b border-white/20"
            >
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            const event = getEventForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[100px] p-2 border border-white/10 transition-all cursor-pointer",
                  getBackgroundColor(event?.status),
                  !isCurrentMonth && "opacity-50"
                )}
              >
                <div className="font-bold text-white">
                  {format(day, 'd')}
                </div>
                
                {event && (
                  <div className="mt-1">
                    {event.isRecurring ? (
                      <AnimatedBrandName name={event.title} />
                    ) : (
                      <div className="font-bold text-white">
                        {event.title}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

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