/**
 * Writes a scraped day into Supabase. Uses the SECRET key (bypasses row level
 * security), so this only ever runs in the scraper, never in the app.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dishKey } from './shape.js';
import type { DayMenu, MenuItem, Nutrition } from './types.js';

const BATCH = 500;

export function connect(): SupabaseClient | null {
  const raw = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!raw || !key) return null;
  // Accept both the Project URL and the "API URL" (…supabase.co/rest/v1/): keep only the origin.
  const url = new URL(raw).origin;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface DishRow {
  key: string;
  name: string;
  serving_size: string;
  serving_grams: number | null;
  traits: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  fiber_g: number | null;
  sugars_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
}

export function toDishRow(item: MenuItem): DishRow {
  const n = item.nutrition;
  return {
    key: dishKey(item.name, item.servingSize),
    name: item.name,
    serving_size: n?.servingSize || item.servingSize,
    serving_grams: n?.servingGrams ?? null,
    traits: item.traits,
    calories: n?.calories ?? null,
    protein_g: n?.protein ?? null,
    carbs_g: n?.totalCarbs ?? null,
    fat_g: n?.totalFat ?? null,
    saturated_fat_g: n?.saturatedFat ?? null,
    trans_fat_g: n?.transFat ?? null,
    fiber_g: n?.fiber ?? null,
    sugars_g: n?.sugars ?? null,
    cholesterol_mg: n?.cholesterol ?? null,
    sodium_mg: n?.sodium ?? null,
  };
}

export function fromDishRow(r: DishRow): Nutrition {
  return {
    servingSize: r.serving_size,
    servingGrams: num(r.serving_grams),
    calories: num(r.calories),
    protein: num(r.protein_g),
    totalCarbs: num(r.carbs_g),
    totalFat: num(r.fat_g),
    saturatedFat: num(r.saturated_fat_g),
    transFat: num(r.trans_fat_g),
    fiber: num(r.fiber_g),
    sugars: num(r.sugars_g),
    cholesterol: num(r.cholesterol_mg),
    sodium: num(r.sodium_mg),
  };
}

// Postgres numeric can come back as a string.
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface MenuRow {
  date: string;
  hall_id: string;
  period: string;
  is_all_day: boolean;
  station: string;
  course: string;
  dishKey: string; // swapped for dish_id once dishes are upserted
}

export interface HoursRow {
  date: string;
  hall_id: string;
  meal: string;
  start_time: string;
  end_time: string;
}

/** Pure: turns a scraped day into deduplicated table rows. */
export function buildRows(day: DayMenu) {
  const dishes = new Map<string, DishRow>();
  const menu = new Map<string, MenuRow>();
  const hours: HoursRow[] = [];

  for (const hall of day.halls) {
    const periods = [
      ...hall.meals.map((m) => ({ period: m.meal, isAllDay: false, items: m.items })),
      ...hall.allDay.map((s) => ({ period: s.section, isAllDay: true, items: s.items })),
    ];
    for (const { period, isAllDay, items } of periods) {
      for (const item of items) {
        const row = toDishRow(item);
        // Prefer a version that has nutrition if the same dish shows up twice.
        if (!dishes.has(row.key) || (dishes.get(row.key)!.calories === null && row.calories !== null)) dishes.set(row.key, row);
        const m: MenuRow = {
          date: day.date, hall_id: hall.id, period, is_all_day: isAllDay,
          station: item.station, course: item.course, dishKey: row.key,
        };
        menu.set(`${hall.id}|${period}|${item.station}|${row.key}`, m); // matches the table's unique constraint
      }
    }
    for (const m of hall.meals) {
      if (m.start && m.end) hours.push({ date: day.date, hall_id: hall.id, meal: m.meal, start_time: m.start, end_time: m.end });
    }
  }
  return { dishes: [...dishes.values()], menu: [...menu.values()], hours };
}

/** Every dish we already know, so the scraper skips fetching their labels. */
export async function loadKnownNutrition(db: SupabaseClient): Promise<Record<string, Nutrition>> {
  const out: Record<string, Nutrition> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('dishes').select('*').not('calories', 'is', null).range(from, from + 999);
    if (error) throw new Error(`Supabase: reading dishes failed: ${error.message}`);
    for (const r of data as DishRow[]) out[r.key] = fromDishRow(r);
    if (data.length < 1000) return out;
  }
}

/** Keep `keepDays` days including today: returns the first date to KEEP (older dates get deleted). */
export function retentionCutoff(today: string, keepDays: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (keepDays - 1));
  return d.toISOString().slice(0, 10);
}

/** Deletes daily menus and hours older than the retention window. Dishes are never deleted. */
export async function deleteOldMenus(db: SupabaseClient, today: string, keepDays: number) {
  const cutoff = retentionCutoff(today, keepDays);
  let deleted = 0;
  for (const table of ['menu_items', 'meal_hours']) {
    const { count, error } = await db.from(table).delete({ count: 'exact' }).lt('date', cutoff);
    if (error) throw new Error(`Supabase: deleting old ${table} failed: ${error.message}`);
    deleted += count ?? 0;
  }
  return { cutoff, deleted };
}

/** Upserts dishes, then replaces this date's menu and hours (so reruns don't duplicate). */
export async function saveDay(db: SupabaseClient, day: DayMenu) {
  const { dishes, menu, hours } = buildRows(day);

  const ids = new Map<string, number>();
  for (let i = 0; i < dishes.length; i += BATCH) {
    const { data, error } = await db
      .from('dishes')
      .upsert(dishes.slice(i, i + BATCH).map((d) => ({ ...d, updated_at: new Date().toISOString() })), { onConflict: 'key' })
      .select('id, key');
    if (error) throw new Error(`Supabase: saving dishes failed: ${error.message}`);
    for (const r of data) ids.set(r.key, r.id);
  }

  for (const table of ['menu_items', 'meal_hours']) {
    const { error } = await db.from(table).delete().eq('date', day.date);
    if (error) throw new Error(`Supabase: clearing ${table} for ${day.date} failed: ${error.message}`);
  }

  const menuRows = menu.map(({ dishKey: k, ...rest }) => ({ ...rest, dish_id: ids.get(k)! }));
  for (let i = 0; i < menuRows.length; i += BATCH) {
    const { error } = await db.from('menu_items').insert(menuRows.slice(i, i + BATCH));
    if (error) throw new Error(`Supabase: saving menu failed: ${error.message}`);
  }
  if (hours.length) {
    const { error } = await db.from('meal_hours').insert(hours);
    if (error) throw new Error(`Supabase: saving hours failed: ${error.message}`);
  }
  return { dishes: dishes.length, menuItems: menuRows.length, hours: hours.length };
}
