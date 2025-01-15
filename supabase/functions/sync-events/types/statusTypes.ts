export type EventStatus = 'confirmed' | 'pending' | 'cancelled';

export interface StatusTransition {
  previousStatus: EventStatus;
  newStatus: EventStatus;
  confidence: number;
  timestamp: Date;
}

export interface IntegrityCheck {
  dateMatch: boolean;
  colorFormatValid: boolean;
  statusTransitionValid: boolean;
  confidenceThresholdMet: boolean;
}