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
    <div className="flex items-center mb-4 relative px-32">
      <Button
        variant="outline"
        onClick={() => onDateChange(subMonths(currentDate, 1))}
        className="absolute left-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="w-full flex justify-center">
        <h1 className="text-4xl font-bold text-white">
          {format(currentDate, 'MMMM yyyy')}
        </h1>
      </div>
      
      <Button
        variant="outline"
        onClick={() => onDateChange(addMonths(currentDate, 1))}
        className="absolute right-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};