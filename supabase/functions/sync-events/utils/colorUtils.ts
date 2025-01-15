import { RGBColor, ColorMatchResult, ColorReference } from '../types/colorTypes';

const TOLERANCE = 10;

export function normalizeColor(color: any): RGBColor | null {
  try {
    if (color && typeof color.red === 'number' && color.red <= 1) {
      return {
        red: Math.round(color.red * 255),
        green: Math.round(color.green * 255),
        blue: Math.round(color.blue * 255)
      };
    }
    
    if (color && typeof color.red === 'number' && color.red > 1) {
      return {
        red: Math.round(color.red),
        green: Math.round(color.green),
        blue: Math.round(color.blue)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Color normalization failed:', error);
    return null;
  }
}

export function colorToHex(color: RGBColor): string {
  return `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`.toLowerCase();
}

export function getColorDistance(color1: RGBColor, color2: RGBColor): number {
  return Math.sqrt(
    Math.pow(color1.red - color2.red, 2) +
    Math.pow(color1.green - color2.green, 2) +
    Math.pow(color1.blue - color2.blue, 2)
  );
}

export function isInColorRange(color: RGBColor, ranges: ColorReference['ranges']): boolean {
  return (
    color.red >= ranges.red.min && color.red <= ranges.red.max &&
    color.green >= ranges.green.min && color.green <= ranges.green.max &&
    color.blue >= ranges.blue.min && color.blue <= ranges.blue.max
  );
}