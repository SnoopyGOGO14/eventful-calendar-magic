import { format, startOfWeek, addDays } from 'date-fns';
import { Event } from './Calendar';
import { CalendarDay } from './CalendarDay';
import { useIsMobile } from '@/hooks/use-mobile';

interface CalendarGridProps {
  days: Date[];
  currentDate: Date;
  events: Event[];
  isLoading?: boolean;
  onSelectDate: (date: Date) => void;
}

export const CalendarGrid = ({ 
  days, 
  currentDate, 
  events = [], 
  isLoading = false,
  onSelectDate 
}: CalendarGridProps) => {
  const isMobile = useIsMobile();
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const getEventsForDate = (date: Date): Event[] => {
    if (!events) {
      console.log('No events array provided');
      return [];
    }
    
    const formattedTargetDate = format(date, 'yyyy-MM-dd');
    console.log('Looking for events on:', formattedTargetDate);
    
    const matchingEvents = events.filter(event => {
      // Direct string comparison since event.date is already in YYYY-MM-DD format
      const matches = event.date === formattedTargetDate;
      if (matches) {
        console.log('Found matching event:', event);
      }
      return matches;
    });

    if (matchingEvents.length > 0) {
      console.log(`Found ${matchingEvents.length} events for ${formattedTargetDate}:`, matchingEvents);
    } else {
      console.log(`No events found for ${formattedTargetDate}`);
    }
    
    return matchingEvents;
  };

  // Get the first day of the grid (Monday of the first week)
  const firstDayOfGrid = startOfWeek(days[0], { weekStartsOn: 1 });
  
  // Generate all days for the grid (6 weeks × 7 days)
  const allGridDays = Array.from({ length: 42 }, (_, i) => 
    addDays(firstDayOfGrid, i)
  );

  return (
    <div className="grid grid-cols-7 gap-1 mt-4">
      {dayNames.map((day) => (
        <div 
          key={day} 
          className="p-2 text-white font-bold text-center border-b border-white/20"
        >
          {day}
        </div>
      ))}

      {allGridDays.map((date) => (
        <CalendarDay
          key={date.toString()}
          date={date}
          currentDate={currentDate}
          events={getEventsForDate(date)}
          onSelect={onSelectDate}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
};