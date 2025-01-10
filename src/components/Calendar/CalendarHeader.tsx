import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onDateChange,
}) => {
  return (
    <div className="flex items-center justify-center relative mb-4 min-h-[48px]">
      <Button
        variant="outline"
        onClick={() => onDateChange(subMonths(currentDate, 1))}
        className="absolute left-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <h1 className="text-4xl font-bold text-white px-20">
        {format(currentDate, 'MMMM yyyy')}
      </h1>
      
      <Button
        variant="outline"
        onClick={() => onDateChange(addMonths(currentDate, 1))}
        className="absolute right-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};