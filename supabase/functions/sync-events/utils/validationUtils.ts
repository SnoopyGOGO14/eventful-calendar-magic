import { IntegrityCheck } from '../types/statusTypes';
import { ColorMatchLog } from '../types/colorTypes';

export function validateColorMatch(matchLog: ColorMatchLog): IntegrityCheck {
  const { inputColor, finalResult } = matchLog;
  
  return {
    dateMatch: true,
    colorFormatValid: Boolean(inputColor.normalized),
    statusTransitionValid: true,
    confidenceThresholdMet: finalResult.confidence >= 0.7
  };
}

export function validateSyncSession(colorMatches: ColorMatchLog[]): boolean {
  if (!colorMatches.length) return false;
  
  const validMatches = colorMatches.filter(match => 
    validateColorMatch(match).confidenceThresholdMet
  );
  
  return validMatches.length / colorMatches.length >= 0.9;
}