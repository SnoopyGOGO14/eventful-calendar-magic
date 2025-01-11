import { format, startOfWeek, addDays } from 'date-fns';
import { Event } from './Calendar';
import { CalendarDay } from './CalendarDay';
import { useIsMobile } from '@/hooks/use-mobile';

interface CalendarGridProps {
  days: Date[];
  currentDate: Date;
  events?: Event[];
  onSelectDate: (date: Date) => void;
}

export const CalendarGrid = ({ days, currentDate, events, onSelectDate }: CalendarGridProps) => {
  const isMobile = useIsMobile();
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const getEventForDate = (date: Date): Event | undefined => {
    return events?.find(event => 
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

      {allGridDays.map((day) => (
        <CalendarDay
          key={day.toString()}
          day={day}
          currentDate={currentDate}
          event={getEventForDate(day)}
          onSelect={onSelectDate}
        />
      ))}
    </div>
  );
};