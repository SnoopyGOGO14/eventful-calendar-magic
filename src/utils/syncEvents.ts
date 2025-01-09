import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const syncEvents = async (spreadsheetId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('sync-events', {
      body: { spreadsheetId }
    });

    if (error) {
      console.error('Error syncing events:', error);
      toast.error('Failed to sync events');
      return;
    }

    console.log('Sync response:', data);
    toast.success('Events synced successfully');
  } catch (err) {
    console.error('Error calling sync function:', err);
    toast.error('Failed to sync events');
  }
};