import { v4 as uuidv4 } from 'uuid';
import { SyncSession, SyncMetrics } from '../types/syncTypes';
import { ColorMatchLog } from '../types/colorTypes';
import { validateSyncSession } from '../utils/validationUtils';

export class SyncService {
  private currentSession: SyncSession | null = null;
  private sessions: SyncSession[] = [];

  startSession(): void {
    this.currentSession = {
      id: uuidv4(),
      startTime: new Date(),
      totalEvents: 0,
      processedEvents: 0,
      colorMatches: [],
      errors: []
    };
  }

  endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.sessions.push(this.currentSession);
      this.currentSession = null;
    }
  }

  addColorMatch(match: ColorMatchLog): void {
    if (this.currentSession) {
      this.currentSession.colorMatches.push(match);
      this.currentSession.processedEvents++;
    }
  }

  addError(error: Error): void {
    if (this.currentSession) {
      this.currentSession.errors.push(error);
    }
  }

  getSessionMetrics(): SyncMetrics {
    if (!this.currentSession) {
      throw new Error('No active sync session');
    }

    const { startTime, processedEvents, colorMatches, errors } = this.currentSession;
    const totalTime = Date.now() - startTime.getTime();

    return {
      colorMatchSuccessRate: colorMatches.filter(m => m.finalResult.confidence > 0.7).length / processedEvents,
      averageProcessingTime: totalTime / processedEvents,
      errorFrequency: errors.reduce((acc, err) => {
        const key = err.message;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  validateSession(): boolean {
    if (!this.currentSession) return false;
    return validateSyncSession(this.currentSession.colorMatches);
  }
}