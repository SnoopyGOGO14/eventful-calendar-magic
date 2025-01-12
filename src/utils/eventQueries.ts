import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type EventRow = Database['public']['Tables']['events']['Row'];

export async function getEventsBetweenDates(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('events')
    .select()
    .gte('date', startDate)
    .lte('date', endDate);
  
  if (error) throw error;
  return data as EventRow[];
}

export async function getEventsByStatus(status: 'confirmed' | 'pending' | 'cancelled') {
  const { data, error } = await supabase
    .from('events')
    .select()
    .eq('status', status);
  
  if (error) throw error;
  return data as EventRow[];
}

export async function getUpcomingEvents(daysAhead: number = 30) {
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
    
  return getEventsBetweenDates(startDate, endDate);
}

export async function getEventsByPromoter(promoterName: string) {
  const { data, error } = await supabase
    .from('events')
    .select()
    .eq('promoter', promoterName);
  
  if (error) throw error;
  return data as EventRow[];
}