import { 
  RGBColor, 
  ColorMatchResult, 
  ColorMatchLog,
  ColorCalibration 
} from '../types/colorTypes';
import { EventStatus } from '../types/statusTypes';
import { 
  normalizeColor, 
  colorToHex, 
  getColorDistance, 
  isInColorRange 
} from '../utils/colorUtils';

const STATUS_COLORS = {
  confirmed: {
    rgb: { red: 147, green: 196, blue: 125 },
    hex: '#93c47d',
    ranges: {
      red: { min: 130, max: 160 },
      green: { min: 180, max: 210 },
      blue: { min: 110, max: 140 }
    }
  },
  cancelled: {
    rgb: { red: 224, green: 102, blue: 102 },
    hex: '#e06666',
    ranges: {
      red: { min: 210, max: 240 },
      green: { min: 90, max: 120 },
      blue: { min: 90, max: 120 }
    }
  },
  pending: {
    rgb: { red: 255, green: 217, blue: 102 },
    hex: '#ffd966',
    ranges: {
      red: { min: 240, max: 255 },
      green: { min: 200, max: 230 },
      blue: { min: 90, max: 120 }
    }
  }
};

export class ColorService {
  private calibrations: Map<EventStatus, ColorCalibration> = new Map();
  private readonly TOLERANCE = 10;

  matchColor(color: RGBColor): ColorMatchResult {
    const matches: ColorMatchResult[] = [];

    // Try exact matches with tolerance
    Object.entries(STATUS_COLORS).forEach(([key, reference]) => {
      const distance = getColorDistance(color, reference.rgb);
      const confidence = Math.max(0, 1 - (distance / (this.TOLERANCE * 3)));
      
      if (distance <= this.TOLERANCE) {
        matches.push({
          status: key as EventStatus,
          confidence,
          method: distance === 0 ? 'exact' : 'tolerance'
        });
      }
    });

    // Return best match if found
    if (matches.length > 0) {
      return matches.reduce((a, b) => a.confidence > b.confidence ? a : b);
    }

    // Try range-based matching
    for (const [key, reference] of Object.entries(STATUS_COLORS)) {
      if (isInColorRange(color, reference.ranges)) {
        return {
          status: key as EventStatus,
          confidence: 0.7,
          method: 'range'
        };
      }
    }

    // Fallback to RGB analysis
    const { red, green, blue } = color;
    if (green > 140 && green > red && green > blue) {
      return { status: 'confirmed', confidence: 0.5, method: 'fallback' };
    }
    if (red > 200 && red > green && red > blue) {
      return { status: 'cancelled', confidence: 0.5, method: 'fallback' };
    }
    if (red > 200 && green > 140 && blue < 120) {
      return { status: 'pending', confidence: 0.5, method: 'fallback' };
    }

    return { status: 'pending', confidence: 0, method: 'fallback' };
  }

  createMatchLog(backgroundColor: any): ColorMatchLog {
    const normalizedColor = normalizeColor(backgroundColor);
    if (!normalizedColor) {
      throw new Error('Failed to normalize color');
    }

    const matchResult = this.matchColor(normalizedColor);
    
    return {
      inputColor: {
        raw: JSON.stringify(backgroundColor),
        normalized: normalizedColor,
        hex: colorToHex(normalizedColor)
      },
      matchAttempts: [{
        level: 1,
        method: matchResult.method,
        confidence: matchResult.confidence,
        result: matchResult.confidence > 0.7
      }],
      finalResult: matchResult,
      timestamp: new Date()
    };
  }

  updateCalibration(status: EventStatus, color: RGBColor): void {
    const existing = this.calibrations.get(status) || {
      baseColor: STATUS_COLORS[status].rgb,
      observedVariations: [],
      successfulMatches: 0,
      lastUpdated: new Date()
    };

    existing.observedVariations.push(color);
    existing.successfulMatches++;
    existing.lastUpdated = new Date();

    this.calibrations.set(status, existing);
  }
}