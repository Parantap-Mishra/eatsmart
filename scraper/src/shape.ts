import type { HoursRow } from './parse.js';
import type { AllDaySection, MealPeriod, MenuItem } from './types.js';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Light Lunch', 'Dinner'];
/** Fallback only: the station NetNutrition puts all-day items under. */
const ALL_DAY_STATION = 'Build Your Own';

export interface SplitResult {
  meals: MealPeriod[];
  allDay: AllDaySection[];
  usedFallback: boolean;
}

/**
 * NetNutrition lists "Salad Bar", "Cereal" etc. as if they were meals.
 * Rule: a menu is a real meal only if UIUC's hours table has hours for it at
 * this hall. Everything else is available all day.
 * If we have no hours at all for this hall (hours page down/changed), fall
 * back to the station name so we don't dump every meal into all-day.
 */
export function splitMeals(menus: Map<string, MenuItem[]>, hallHours: HoursRow[]): SplitResult {
  const usedFallback = hallHours.length === 0;
  const meals: MealPeriod[] = [];
  const allDay: AllDaySection[] = [];

  for (const [name, items] of menus) {
    const hours = hallHours.find((h) => h.meal === name);
    const isMeal = usedFallback ? !items.every((i) => i.station === ALL_DAY_STATION) : Boolean(hours);
    if (isMeal) meals.push({ meal: name, start: hours?.start ?? null, end: hours?.end ?? null, items });
    else allDay.push({ section: name, items });
  }

  meals.sort((a, b) => rank(a.meal) - rank(b.meal));
  return { meals, allDay, usedFallback };
}

function rank(meal: string) {
  const i = MEAL_ORDER.indexOf(meal);
  return i === -1 ? 99 : i;
}
