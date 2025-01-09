import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { AnimatedBrandName } from './AnimatedBrandName';
import { NoteModal } from './NoteModal';
import { CalendarHeader } from './CalendarHeader';
import { useCalendarData } from '@/hooks/useCalendarData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const { events, isLoading } = useCalendarData();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncEvents('10HjBOsJemFkmRbu-EGG0BnFUKAh0FMhPWsvjuSlGokw');
      toast.success('Calendar synced successfully!');
    } catch (error) {
      toast.error('Failed to sync calendar. Please check setup.');
    } finally {
      setIsSyncing(false);
    }
  };

  const setupSteps = [
    {
      title: "Step 1: Open Your Google Sheet",
      description: "Click the button below to open your Google Sheet in a new tab.",
      action: () => {
        window.open('https://docs.google.com/spreadsheets/d/10HjBOsJemFkmRbu-EGG0BnFUKAh0FMhPWsvjuSlGokw', '_blank');
        setSetupStep(2);
      }
    },
    {
      title: "Step 2: Share Your Sheet",
      description: "Click 'Share' in the top right of your Google Sheet and add this email as an Editor: loveable-calendar-2@loveable-calendar-2.iam.gserviceaccount.com",
      action: () => setSetupStep(3)
    },
    {
      title: "Step 3: Sync Calendar",
      description: "Now that everything is set up, click below to sync your calendar with the Google Sheet.",
      action: handleSync
    }
  ];

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
            onClick={() => setShowSetupDialog(true)}
            className="bg-green-500 hover:bg-green-600"
          >
            Setup & Sync Calendar
          </Button>
        </div>
        
        <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{setupSteps[setupStep - 1].title}</DialogTitle>
              <DialogDescription className="py-4">
                {setupSteps[setupStep - 1].description}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-between items-center mt-4">
              {setupStep > 1 && (
                <Button variant="outline" onClick={() => setSetupStep(step => step - 1)}>
                  Previous
                </Button>
              )}
              <Button 
                onClick={setupSteps[setupStep - 1].action}
                disabled={isSyncing}
                className="ml-auto"
              >
                {setupStep === 3 ? (isSyncing ? 'Syncing...' : 'Sync Now') : 'Continue'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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