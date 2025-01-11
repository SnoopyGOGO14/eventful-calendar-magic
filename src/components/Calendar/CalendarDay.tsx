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
          <div className="mt-1 text-white">
            {event.isRecurring ? (
              <AnimatedBrandName name={event.title} />
            ) : (
              <div className="font-bold">
                {event.title}
              </div>
            )}
          </div>
          
          {statusBand && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 py-0.5 text-center", // Reduced padding from py-1 to py-0.5
              statusBand.bg
            )}>
              <span className="text-white text-xs font-medium"> {/* Reduced text size from text-sm to text-xs */}
                {statusBand.text}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};