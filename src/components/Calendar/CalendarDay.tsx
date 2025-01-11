import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Event } from './Calendar';

interface CalendarDayProps {
  date: Date;
  currentDate: Date;
  event?: Event;
  onSelect: (date: Date) => void;
}

export const CalendarDay: React.FC<CalendarDayProps> = ({
  date,
  currentDate,
  event,
  onSelect,
}) => {
  const getStatusBand = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return {
          bg: 'bg-green-500',
          text: 'Confirmed'
        };
      case 'pending':
        return {
          bg: 'bg-yellow-500',
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

  return (
    <div 
      className="min-h-[120px] bg-[#234B61] p-2 rounded-lg relative cursor-pointer hover:bg-[#2D5D78] transition-colors"
      onClick={() => onSelect(date)}
    >
      <div className="text-white mb-2">
        {format(date, 'd')}
      </div>
      
      {event && (
        <div 
          className="relative bg-[#1B3A4B] p-2 rounded mb-2 last:mb-0"
        >
          <div className="text-white">
            {event.title && (
              <div className="font-medium mb-1">
                {event.title}
              </div>
            )}
          </div>
          
          {event.status && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-[6px]",
              getStatusBand(event.status)?.bg
            )}>
              <span className="absolute bottom-[-16px] left-0 right-0 text-center text-xs text-white/70">
                {getStatusBand(event.status)?.text}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};