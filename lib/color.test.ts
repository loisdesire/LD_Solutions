import { describe, expect, it } from 'vitest';
import { getContrastColor, hexToHueSat, hexToRgba } from './color';

// getContrastColor decides black-vs-white text on every business's own
// accent color across the app - wrong in either direction is a real,
// visible readability bug (white-on-white or black-on-black text) a
// business owner can trigger just by picking a color in Settings.
// hexToHueSat drives AccentScope's palette derivation. Fixtures below are
// real computed values, not hand-derived by eye.
describe('hexToRgba', () => {
  it('parses a 6-digit hex into its real r/g/b channels', () => {
    expect(hexToRgba('#C4512D', 0.5)).toBe('rgba(196, 81, 45, 0.5)');
  });

  it('expands a 3-digit shorthand hex before parsing', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('hexToHueSat', () => {
  it('reports a real hue and saturation for a genuinely saturated color', () => {
    const { hue, sat } = hexToHueSat('#C4512D');
    expect(hue).toBeCloseTo(14.3, 1);
    expect(sat).toBeCloseTo(0.627, 2);
  });

  it('reports zero saturation for a true grey - hue is meaningless there, so it must not report a misleading one', () => {
    expect(hexToHueSat('#808080')).toEqual({ hue: 0, sat: 0 });
  });

  it('reports zero saturation for pure black, rather than dividing by zero into NaN', () => {
    const { hue, sat } = hexToHueSat('#000000');
    expect(sat).toBe(0);
    expect(Number.isNaN(hue)).toBe(false);
  });
});

describe('getContrastColor', () => {
  it('puts dark text on white', () => {
    expect(getContrastColor('#FFFFFF')).toBe('#0f172a');
  });

  it('puts light text on black', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
  });

  it('puts light text on the platform’s own mid-tone terracotta accent', () => {
    expect(getContrastColor('#C4512D')).toBe('#ffffff');
  });

  it('puts dark text on a pale cream accent', () => {
    expect(getContrastColor('#F3E8BC')).toBe('#0f172a');
  });
});
