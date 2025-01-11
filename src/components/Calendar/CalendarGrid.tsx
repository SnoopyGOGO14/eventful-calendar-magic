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
    if (!events) return [];
    return events.filter(event => 
      format(new Date(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
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