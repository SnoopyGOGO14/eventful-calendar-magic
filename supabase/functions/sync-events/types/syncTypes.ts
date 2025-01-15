import { ColorMatchLog } from './colorTypes';

export interface SyncSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  totalEvents: number;
  processedEvents: number;
  colorMatches: ColorMatchLog[];
  errors: Error[];
}

export interface SyncMetrics {
  colorMatchSuccessRate: number;
  averageProcessingTime: number;
  errorFrequency: Record<string, number>;
}