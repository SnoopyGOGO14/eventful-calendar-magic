import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface NoteModalProps {
  date: Date;
  onClose: () => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({ date, onClose }) => {
  const [note, setNote] = useState('');

  useEffect(() => {
    const savedNote = localStorage.getItem(`note-${format(date, 'yyyy-MM-dd')}`);
    if (savedNote) {
      setNote(savedNote);
    }
  }, [date]);

  const handleSave = () => {
    localStorage.setItem(`note-${format(date, 'yyyy-MM-dd')}`, note);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Notes for {format(date, 'MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
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