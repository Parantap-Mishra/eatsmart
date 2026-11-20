import { describe, expect, it } from 'vitest';
import { buildRows, fromDishRow, toDishRow } from '../src/db.js';
import type { DayMenu, MenuItem, Nutrition } from '../src/types.js';

const nutrition: Nutrition = {
  servingSize: 'Each (113g)', servingGrams: 113, calories: 310, protein: 30, totalCarbs: 1, totalFat: 21,
  saturatedFat: 8, transFat: 1, fiber: 0, sugars: 0, cholesterol: 90, sodium: 380,
};
const burger = (station: string, n: Nutrition | null = nutrition): MenuItem => ({
  name: 'Halal Beef Burger', station, course: 'Entrees', servingSize: 'Each', traits: ['Halal'], nutrition: n,
});

const day: DayMenu = {
  date: '2026-11-19',
  scrapedAt: '2026-11-19T12:00:00Z',
  source: 'test',
  halls: [
    {
      id: 'isr', name: 'ISR',
      meals: [
        { meal: 'Lunch', start: '10:30', end: '14:00', items: [burger('Grillworks'), burger('Inclusive Solutions'), burger('Grillworks')] },
        { meal: 'Dinner', start: null, end: null, items: [burger('Grillworks', null)] },
      ],
      allDay: [{ section: 'Salad Bar', items: [{ ...burger('Build Your Own'), name: 'Grilled Chicken' }] }],
    },
  ],
};

describe('buildRows', () => {
  const rows = buildRows(day);

  it('stores each dish once, keeping the version with nutrition', () => {
    expect(rows.dishes.map((d) => d.key).sort()).toEqual(['grilled chicken|each', 'halal beef burger|each']);
    expect(rows.dishes.find((d) => d.name === 'Halal Beef Burger')!.calories).toBe(310);
  });

  it('dedupes menu rows on (hall, period, station, dish) and marks all-day sections', () => {
    expect(rows.menu.map((m) => `${m.period}/${m.station}/${m.is_all_day}`)).toEqual([
      'Lunch/Grillworks/false',
      'Lunch/Inclusive Solutions/false',
      'Dinner/Grillworks/false',
      'Salad Bar/Build Your Own/true',
    ]);
  });

  it('only saves hours for meals that have them', () => {
    expect(rows.hours).toEqual([{ date: '2026-11-19', hall_id: 'isr', meal: 'Lunch', start_time: '10:30', end_time: '14:00' }]);
  });
});

describe('dish row mapping', () => {
  it('round-trips nutrition through a database row', () => {
    expect(fromDishRow(toDishRow(burger('Grillworks')))).toEqual(nutrition);
  });
  it('turns Postgres numeric strings back into numbers', () => {
    const row = { ...toDishRow(burger('Grillworks')), calories: '310' as unknown as number };
    expect(fromDishRow(row).calories).toBe(310);
  });
  it('keeps the menu serving size when there is no nutrition label', () => {
    expect(toDishRow(burger('Grillworks', null))).toMatchObject({ serving_size: 'Each', calories: null });
  });
});
