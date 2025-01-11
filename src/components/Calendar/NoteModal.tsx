import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NoteModalProps {
  date: Date;
  onClose: () => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({ date, onClose }) => {
  const [note, setNote] = useState('');
  const formattedDate = format(date, 'yyyy-MM-dd');

  // Fetch event details for the selected date
  const { data: eventDetails } = useQuery({
    queryKey: ['event', formattedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('room, promoter, capacity')
        .eq('date', formattedDate)
        .single();
      return data;
    },
  });

  useEffect(() => {
    const savedNote = localStorage.getItem(`note-${formattedDate}`);
    if (savedNote) {
      setNote(savedNote);
    }
  }, [formattedDate]);

  const handleSave = () => {
    localStorage.setItem(`note-${formattedDate}`, note);
    onClose();
  };

  // Create the pre-filled event details text
  const eventDetailsText = eventDetails
    ? `Room: ${eventDetails.room || 'N/A'}\nPromoter: ${eventDetails.promoter || 'N/A'}\nCapacity: ${eventDetails.capacity || 'N/A'}\n\n`
    : '';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Notes for {format(date, 'MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {eventDetails && (
            <div className="mb-4 p-3 bg-secondary rounded-md text-sm">
              <div><strong>Room:</strong> {eventDetails.room || 'N/A'}</div>
              <div><strong>Promoter:</strong> {eventDetails.promoter || 'N/A'}</div>
              <div><strong>Capacity:</strong> {eventDetails.capacity || 'N/A'}</div>
            </div>
          )}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter your notes here..."
            className="min-h-[200px]"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};