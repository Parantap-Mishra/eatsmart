import { describe, expect, it } from 'vitest';
import { splitMeals } from '../src/shape.js';
import type { HoursRow } from '../src/parse.js';
import type { MenuItem } from '../src/types.js';

const item = (name: string, station: string): MenuItem => ({
  name, station, course: '', servingSize: '1 each', traits: [], nutrition: null,
});

// Shaped like ISR on 2026-11-10: real meals come from several stations,
// "Salad Bar"/"Cereal" come only from Build Your Own and have no hours.
const menus = () =>
  new Map<string, MenuItem[]>([
    ['Dinner', [item('Beef Chili', 'Grillworks'), item('Tofu Stir Fry', 'Fusion 48')]],
    ['Salad Bar', [item('Grilled Chicken', 'Build Your Own')]],
    ['Breakfast', [item('Scrambled Eggs', 'Grillworks')]],
    ['Cereal', [item('Cheerios', 'Build Your Own')]],
    ['Lunch', [item('Halal Beef Burger', 'Grillworks')]],
  ]);

const hours: HoursRow[] = [
  { hoursId: 3, meal: 'Breakfast', start: '7:00', end: '10:00' },
  { hoursId: 3, meal: 'Lunch', start: '10:30', end: '14:00' },
  { hoursId: 3, meal: 'Dinner', start: '16:30', end: '20:00' },
];

describe('splitMeals', () => {
  it('keeps only menus with hours as meals, in meal order, with hours attached', () => {
    const { meals, usedFallback } = splitMeals(menus(), hours);
    expect(usedFallback).toBe(false);
    expect(meals.map((m) => [m.meal, m.start, m.end])).toEqual([
      ['Breakfast', '7:00', '10:00'],
      ['Lunch', '10:30', '14:00'],
      ['Dinner', '16:30', '20:00'],
    ]);
  });

  it('moves menus without hours into all-day sections', () => {
    const { allDay } = splitMeals(menus(), hours);
    expect(allDay.map((s) => s.section)).toEqual(['Salad Bar', 'Cereal']);
    expect(allDay[0].items[0].name).toBe('Grilled Chicken');
  });

  it('uses hours, not station name, when hours exist', () => {
    // A Build Your Own-only menu that does have hours is still a real meal.
    const m = new Map([['Light Lunch', [item('Deli Turkey', 'Build Your Own')]]]);
    const { meals } = splitMeals(m, [{ hoursId: 1, meal: 'Light Lunch', start: '13:30', end: '15:00' }]);
    expect(meals.map((x) => x.meal)).toEqual(['Light Lunch']);
  });

  it('falls back to the station name when there are no hours at all', () => {
    const { meals, allDay, usedFallback } = splitMeals(menus(), []);
    expect(usedFallback).toBe(true);
    expect(meals.map((m) => [m.meal, m.start])).toEqual([
      ['Breakfast', null],
      ['Lunch', null],
      ['Dinner', null],
    ]);
    expect(allDay.map((s) => s.section)).toEqual(['Salad Bar', 'Cereal']);
  });
});
