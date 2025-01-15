import React from 'react';
import { format, addMonths, subMonths, isBefore, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  minDate: Date;
  maxDate: Date;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onDateChange,
  minDate,
  maxDate,
}) => {
  const handlePreviousMonth = () => {
    const newDate = subMonths(currentDate, 1);
    if (!isBefore(newDate, minDate)) {
      onDateChange(newDate);
    }
  };

  const handleNextMonth = () => {
    const newDate = addMonths(currentDate, 1);
    if (!isAfter(newDate, maxDate)) {
      onDateChange(newDate);
    }
  };

  const isPreviousDisabled = isBefore(subMonths(currentDate, 1), minDate);
  const isNextDisabled = isAfter(addMonths(currentDate, 1), maxDate);

  return (
    <div className="flex items-center justify-between mb-4 relative h-16">
      <Button
        variant="outline"
        onClick={handlePreviousMonth}
        disabled={isPreviousDisabled}
        className="absolute left-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex-1 flex justify-center">
        <h1 className="text-4xl font-bold text-white w-[600px] text-center">
          {format(currentDate, 'MMMM yyyy')}
        </h1>
      </div>
      
      <Button
        variant="outline"
        onClick={handleNextMonth}
        disabled={isNextDisabled}
        className="absolute right-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};