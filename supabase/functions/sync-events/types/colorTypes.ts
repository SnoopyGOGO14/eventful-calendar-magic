export interface RGBColor {
  red: number;
  green: number;
  blue: number;
}

export interface ColorRange {
  min: number;
  max: number;
}

export interface ColorReference {
  rgb: RGBColor;
  hex: string;
  ranges: {
    red: ColorRange;
    green: ColorRange;
    blue: ColorRange;
  };
}

export interface ColorMatchResult {
  status: EventStatus;
  confidence: number;
  method: 'exact' | 'tolerance' | 'range' | 'fallback';
}

export interface ColorMatchLog {
  inputColor: {
    raw: string;
    normalized: RGBColor;
    hex: string;
  };
  matchAttempts: {
    level: number;
    method: string;
    confidence: number;
    result: boolean;
  }[];
  finalResult: {
    status: EventStatus;
    confidence: number;
    method: string;
  };
  timestamp: Date;
}

export interface ColorCalibration {
  baseColor: RGBColor;
  observedVariations: RGBColor[];
  successfulMatches: number;
  lastUpdated: Date;
}