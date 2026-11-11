/**
 * Scrapes today's menu + nutrition for the 4 UIUC dining halls into
 * output/menu-YYYY-MM-DD.json.   Run: npm run scrape
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HALLS, HOURS_PAGE, NETNUTRITION_BASE } from './config.js';
import { PoliteSession } from './http.js';
import {
  normalizeName, parseChildUnits, parseHours, parseLabel, parseMenuItems, parseMenuList, parsePanels,
  type HoursRow,
} from './parse.js';
import type { DayMenu, HallMenu, MealPeriod, Nutrition } from './types.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = join(ROOT, 'cache', 'nutrition.json');
const MEAL_ORDER = ['Breakfast', 'Lunch', 'Light Lunch', 'Dinner'];

function todayInChampaign(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}

function loadCache(): Record<string, Nutrition> {
  return existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
}

function saveJson(file: string, data: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

async function main() {
  const started = Date.now();
  const date = todayInChampaign();
  const session = new PoliteSession();
  const cache = loadCache();
  let labelsFetched = 0;
  let labelsCached = 0;
  const nn = (path: string, form: Record<string, number>) =>
    session.postForm(`${NETNUTRITION_BASE}/${path}`, form).then(parsePanels);

  console.log(`Scraping UIUC dining for ${date} (1 request/sec)...`);

  let hours: HoursRow[] = [];
  try {
    hours = parseHours(await session.get(HOURS_PAGE), date);
  } catch (err) {
    console.warn(`  ! hours unavailable: ${(err as Error).message}`);
  }

  await session.get(NETNUTRITION_BASE); // starts the NetNutrition session (cookies)

  const halls: HallMenu[] = [];
  for (const hall of HALLS) {
    const meals = new Map<string, MealPeriod>();
    const stations = parseChildUnits((await nn('Unit/SelectUnitFromUnitsList', { unitOid: hall.nnUnitOid })).childUnitsPanel ?? '');
    if (!stations.length) throw new Error(`No stations found for ${hall.name}. Did the site change?`);

    for (const station of stations) {
      const menus = parseMenuList((await nn('Unit/SelectUnitFromChildUnitsList', { unitOid: station.oid })).menuPanel ?? '', date);
      for (const { meal, menuOid } of menus) {
        const rows = parseMenuItems((await nn('Menu/SelectMenu', { menuOid })).itemPanel ?? '');
        for (const row of rows) {
          const key = `${normalizeName(row.name)}|${row.servingSize.toLowerCase()}`;
          let nutrition: Nutrition | null = cache[key] ?? null;
          if (nutrition) labelsCached++;
          else {
            try {
              const html = await session.postForm(`${NETNUTRITION_BASE}/NutritionDetail/ShowItemNutritionLabel`, { detailOid: row.detailOid, menuOid });
              nutrition = cache[key] = parseLabel(html);
              labelsFetched++;
            } catch (err) {
              console.warn(`  ! no nutrition for "${row.name}": ${(err as Error).message}`);
            }
          }
          if (!meals.has(meal)) {
            const h = hours.find((x) => x.hoursId === hall.hoursId && x.meal === meal);
            meals.set(meal, { meal, start: h?.start ?? null, end: h?.end ?? null, items: [] });
          }
          meals.get(meal)!.items.push({
            name: row.name, station: station.name, course: row.course,
            servingSize: row.servingSize, traits: row.traits, nutrition,
          });
        }
      }
    }
    saveJson(CACHE_FILE, cache); // save progress after every hall

    const sorted = [...meals.values()].sort((a, b) => rank(a.meal) - rank(b.meal));
    halls.push({ id: hall.id, name: hall.name, meals: sorted });
    const items = sorted.flatMap((m) => m.items);
    const withNutrition = items.filter((i) => i.nutrition).length;
    console.log(`  ${hall.name}: ${items.length} items across ${sorted.map((m) => m.meal).join(', ') || 'no meals'} (${withNutrition}/${items.length} with nutrition)`);
  }

  const out: DayMenu = { date, scrapedAt: new Date().toISOString(), source: NETNUTRITION_BASE, halls };
  const file = join(ROOT, 'output', `menu-${date}.json`);
  saveJson(file, out);

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`\nDone in ${secs}s, ${session.requestCount} requests. Labels: ${labelsFetched} fetched, ${labelsCached} from cache.`);
  console.log(`Wrote ${file}`);
}

function rank(meal: string) {
  const i = MEAL_ORDER.indexOf(meal);
  return i === -1 ? 99 : i;
}

main().catch((err) => {
  console.error(`\nScrape failed: ${err.message}`);
  process.exit(1);
});
