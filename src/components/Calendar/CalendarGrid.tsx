import { format } from 'date-fns';
import { Event } from './Calendar';
import { CalendarDay } from './CalendarDay';
import { useIsMobile } from '@/hooks/use-mobile';

interface CalendarGridProps {
  days: Date[];
  currentDate: Date;
  events?: (Event & { date: string })[];
  onSelectDate: (date: Date) => void;
}

export const CalendarGrid = ({ days, currentDate, events, onSelectDate }: CalendarGridProps) => {
  const isMobile = useIsMobile();
  const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const dayNamesShort = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const getEventForDate = (date: Date): Event | undefined => {
    return events?.find(event => 
      format(new Date(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  return (
    <div className="grid grid-cols-7 gap-1 mt-4">
      {(isMobile ? dayNamesShort : dayNames).map((day) => (
        <div 
          key={day} 
          className="p-2 text-white font-bold text-center border-b border-white/20"
        >
          {day}
        </div>
      ))}

      {days.map((day) => (
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