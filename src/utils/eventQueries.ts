import { supabase } from '@/integrations/supabase/client';

export async function getEventsBetweenDates(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .rpc('get_events_between_dates', {
      start_date: startDate,
      end_date: endDate
    });
  
  if (error) throw error;
  return data;
}

export async function getEventsByStatus(status: 'confirmed' | 'pending' | 'cancelled') {
  const { data, error } = await supabase
    .rpc('get_events_by_status', {
      event_status: status
    });
  
  if (error) throw error;
  return data;
}

export async function getUpcomingEvents(daysAhead: number = 30) {
  const { data, error } = await supabase
    .rpc('get_upcoming_events', {
      days_ahead: daysAhead
    });
  
  if (error) throw error;
  return data;
}

export async function getEventsByPromoter(promoterName: string) {
  const { data, error } = await supabase
    .rpc('get_events_by_promoter', {
      promoter_name: promoterName
    });
  
  if (error) throw error;
  return data;
}
