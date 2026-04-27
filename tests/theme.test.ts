import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME, DARK_THEME, MINIMAL_THEME, createTheme } from '../src/types/theme';

describe('DEFAULT_THEME', () => {
  it('has all required fields', () => {
    expect(DEFAULT_THEME.name).toBe('default');
    expect(DEFAULT_THEME.colors.nodeFill).toBeDefined();
    expect(DEFAULT_THEME.arrowStyle).toBe('filled');
    expect(DEFAULT_THEME.curveStyle).toBe('bezier');
    expect(DEFAULT_THEME.edgeGap).toBe(8);
    expect(DEFAULT_THEME.arrowSize).toBe(10);
  });
});

describe('DARK_THEME', () => {
  it('has dark background', () => {
    expect(DARK_THEME.colors.background).toBe('#1a1a2e');
    expect(DARK_THEME.colors.nodeFill).toBe('#16213e');
  });
});

describe('MINIMAL_THEME', () => {
  it('uses open arrows and step curves', () => {
    expect(MINIMAL_THEME.arrowStyle).toBe('open');
    expect(MINIMAL_THEME.curveStyle).toBe('step');
  });
});

describe('createTheme', () => {
  it('returns default theme with no overrides', () => {
    const theme = createTheme();
    expect(theme.name).toBe(DEFAULT_THEME.name);
    expect(theme.edgeGap).toBe(DEFAULT_THEME.edgeGap);
  });

  it('applies overrides', () => {
    const theme = createTheme({ edgeGap: 20, arrowSize: 15 });
    expect(theme.edgeGap).toBe(20);
    expect(theme.arrowSize).toBe(15);
    expect(theme.name).toBe(DEFAULT_THEME.name);
  });
});
