import { format, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { AnimatedBrandName } from './AnimatedBrandName';
import { Event } from './Calendar';

interface CalendarDayProps {
  day: Date;
  currentDate: Date;
  event?: Event;
  onSelect: (date: Date) => void;
}

export const CalendarDay = ({ day, currentDate, event, onSelect }: CalendarDayProps) => {
  const getStatusBand = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-green-500',
          text: 'Confirmed'
        };
      case 'pending':
        return {
          bg: 'bg-orange-400',
          text: 'Pending'
        };
      case 'cancelled':
        return {
          bg: 'bg-red-500',
          text: 'Cancelled'
        };
      default:
        return null;
    }
  };

  const isCurrentMonth = isSameMonth(day, currentDate);
  const statusBand = getStatusBand(event?.status);

  return (
    <div
      onClick={() => onSelect(day)}
      className={cn(
        "min-h-[100px] p-2 border border-white/10 transition-all cursor-pointer relative",
        !isCurrentMonth && "opacity-50",
        "bg-transparent"
      )}
    >
      <div className="font-bold text-white">
        {format(day, 'd')}
      </div>
      
      {event && (
        <div className="flex flex-col h-full">
          <div className="text-white">
            {event.isRecurring ? (
              <AnimatedBrandName name={event.title} />
            ) : (
              <div className="font-bold">
                {event.title}
              </div>
            )}
            {event.room && (
              <div className="text-xs text-white/70">
                Room: {event.room}
              </div>
            )}
            {event.promoter && (
              <div className="text-xs text-white/70">
                By: {event.promoter}
              </div>
            )}
            {event.capacity && (
              <div className="text-xs text-white/70">
                Cap: {event.capacity}
              </div>
            )}
          </div>
          
          {statusBand && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-[6px]",
              statusBand.bg
            )}>
              <span className="absolute bottom-[-16px] left-0 right-0 text-center text-xs text-white/70">
                {statusBand.text}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};