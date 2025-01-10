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
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncEvents('18KbXdfe2EfjtP3YahNRs1uJauMoK0yZsJCwzeCBu1kc');
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

  const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const dayNamesShort = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

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
          {(isMobile ? dayNamesShort : dayNames).map((day) => (
            <div 
              key={day} 
              className="p-2 text-white font-bold text-center border-b border-white/20"
            >
              {day}
            </div>
          ))}

          {days.map((day) => {
            const event = getEventForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[100px] p-2 border border-white/10 transition-all cursor-pointer relative",
                  !isCurrentMonth && "opacity-50",
                  "bg-transparent" // Always keep the background transparent
                )}
              >
                <div className="font-bold text-white">
                  {format(day, 'd')}
                </div>
                
                {event && (
                  <>
                    <div className="mt-1 text-white">
                      {event.isRecurring ? (
                        <AnimatedBrandName name={event.title} />
                      ) : (
                        <div className="font-bold">
                          {event.title}
                        </div>
                      )}
                    </div>
                    {event.status === 'confirmed' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-[#F2FCE2] py-1">
                        <span className="text-white text-sm font-medium">
                          Confirmed
                        </span>
                      </div>
                    )}
                  </>
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