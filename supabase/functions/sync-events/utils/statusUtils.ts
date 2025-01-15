import { EventStatus, StatusTransition, IntegrityCheck } from '../types/statusTypes';

const validTransitions: Record<EventStatus, EventStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'pending'],
  cancelled: ['pending']
};

export function isValidStatusTransition(from: EventStatus, to: EventStatus): boolean {
  return validTransitions[from]?.includes(to) || false;
}

export function validateStatusChange(
  previousStatus: EventStatus,
  newStatus: EventStatus,
  confidence: number
): IntegrityCheck {
  return {
    dateMatch: true, // This would be implemented based on your date validation logic
    colorFormatValid: true,
    statusTransitionValid: isValidStatusTransition(previousStatus, newStatus),
    confidenceThresholdMet: confidence >= 0.7
  };
}

export function createStatusTransition(
  previousStatus: EventStatus,
  newStatus: EventStatus,
  confidence: number
): StatusTransition {
  return {
    previousStatus,
    newStatus,
    confidence,
    timestamp: new Date()
  };
}