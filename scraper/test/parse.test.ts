import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatDateHeader, normalizeName, parseChildUnits, parseHours, parseLabel, parseMenuItems, parseMenuList,
  parsePanels, SiteChangedError,
} from '../src/parse.js';

// Real responses saved from UIUC on 2026-11-10.
const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('parsePanels', () => {
  it('splits a NetNutrition response into panels', () => {
    const panels = parsePanels(fixture('nn-unit.json'));
    expect(panels.childUnitsPanel).toContain('Grillworks');
  });
  it('throws SiteChangedError on the start-up error page', () => {
    expect(() => parsePanels('<html><title>NetNutrition Start-up Error</title></html>')).toThrow(SiteChangedError);
  });
  it('throws on unsuccessful JSON', () => {
    expect(() => parsePanels('{"success":false}')).toThrow(SiteChangedError);
  });
});

describe('parseChildUnits', () => {
  it('lists the stations in ISR', () => {
    const stations = parseChildUnits(parsePanels(fixture('nn-unit.json')).childUnitsPanel);
    expect(stations).toHaveLength(10);
    expect(stations).toContainEqual({ oid: 15, name: 'Grillworks' });
  });
});

describe('parseMenuList', () => {
  const html = parsePanels(fixture('nn-station.json')).menuPanel;
  it('finds the meals for a date', () => {
    expect(parseMenuList(html, '2026-11-10')).toEqual([
      { meal: 'Breakfast', menuOid: 1453268 },
      { meal: 'Lunch', menuOid: 1453275 },
      { meal: 'Dinner', menuOid: 1453177 },
    ]);
  });
  it('returns nothing for a date that is not listed', () => {
    expect(parseMenuList(html, '2020-01-01')).toEqual([]);
  });
});

describe('parseMenuItems', () => {
  const rows = parseMenuItems(parsePanels(fixture('nn-menu.json')).itemPanel);
  it('reads item rows with course, serving size and traits', () => {
    const burger = rows.find((r) => r.name === 'Malibu Burger')!;
    expect(burger).toMatchObject({ detailOid: 123102669, course: 'Entrees', servingSize: 'Patty' });
    expect(burger.traits).toEqual(expect.arrayContaining(['Corn', 'Gluten', 'Soy', 'Wheat']));
  });
  it('reads both primary and alternate rows', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining(['Cornbread', 'Halal Beef Burger', 'French Fries']));
  });
  it('item names do not include trait text', () => {
    for (const r of rows) expect(r.name).not.toMatch(/image/i);
  });
});

describe('parseLabel', () => {
  it('reads the Malibu Burger label', () => {
    expect(parseLabel(fixture('nn-label.html'))).toEqual({
      servingSize: 'Patty (91g)',
      servingGrams: 91,
      calories: 170,
      protein: 4,
      totalCarbs: 21,
      totalFat: 9,
      saturatedFat: 1,
      transFat: 0,
      fiber: 4,
      sugars: 2,
      cholesterol: 0,
      sodium: 440,
    });
  });
  it('treats "<1g" as 0.5 and "NA" as null', () => {
    const html = '<div>Nutrition Information Serving Size: 1 cup Amount Per Serving Calories 5 Protein <1g Sugars NA</div>';
    const n = parseLabel(html);
    expect(n.protein).toBe(0.5);
    expect(n.sugars).toBeNull();
  });
  it('throws if the label has no calories', () => {
    expect(() => parseLabel('<div>Something else</div>')).toThrow(SiteChangedError);
  });
});

describe('parseHours', () => {
  it('reads hours for a date', () => {
    const rows = parseHours(fixture('housing-page.html'), '2026-11-10');
    expect(rows).toContainEqual({ hoursId: 1, meal: 'Breakfast', start: '7:00', end: '10:00' });
  });
  it('throws if the hours table is missing', () => {
    expect(() => parseHours('<html></html>', '2026-11-10')).toThrow(SiteChangedError);
  });
});

describe('helpers', () => {
  it('formats NetNutrition date headers', () => {
    expect(formatDateHeader('2026-11-10')).toBe('Tuesday, November 10, 2026');
  });
  it('normalizes names', () => {
    expect(normalizeName('  Mac & Cheese!! ')).toBe('mac and cheese');
  });
});
