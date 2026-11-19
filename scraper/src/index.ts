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
  MissingNutritionError, normalizeName, parseChildUnits, parseHours, parseLabel, parseMenuItems, parseMenuList, parsePanels,
  type HoursRow,
} from './parse.js';
import { splitMeals } from './shape.js';
import type { DayMenu, HallMenu, MenuItem, Nutrition } from './types.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = join(ROOT, 'cache', 'nutrition.json');

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
    const menusByName = new Map<string, MenuItem[]>();
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
              if (err instanceof MissingNutritionError) console.log(`  - "${row.name}": ${err.message}`);
              else console.warn(`  ! no nutrition for "${row.name}": ${(err as Error).message}`);
            }
          }
          if (!menusByName.has(meal)) menusByName.set(meal, []);
          menusByName.get(meal)!.push({
            name: row.name, station: station.name, course: row.course,
            servingSize: row.servingSize, traits: row.traits, nutrition,
          });
        }
      }
    }
    saveJson(CACHE_FILE, cache); // save progress after every hall

    const { meals, allDay, usedFallback } = splitMeals(menusByName, hours.filter((h) => h.hoursId === hall.hoursId));
    if (usedFallback) console.warn(`  ! no hours for ${hall.name}; guessed all-day items by station name`);
    halls.push({ id: hall.id, name: hall.name, meals, allDay });
    const items = [...meals, ...allDay].flatMap((m) => m.items);
    const withNutrition = items.filter((i) => i.nutrition).length;
    console.log(`  ${hall.name}: ${meals.map((m) => `${m.meal} ${m.items.length}`).join(', ') || 'no meals'}, all-day ${allDay.reduce((n, s) => n + s.items.length, 0)} (${withNutrition}/${items.length} with nutrition)`);
  }

  const out: DayMenu = { date, scrapedAt: new Date().toISOString(), source: NETNUTRITION_BASE, halls };
  const file = join(ROOT, 'output', `menu-${date}.json`);
  saveJson(file, out);

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`\nDone in ${secs}s, ${session.requestCount} requests. Labels: ${labelsFetched} fetched, ${labelsCached} from cache.`);
  console.log(`Wrote ${file}`);
}

main().catch((err) => {
  console.error(`\nScrape failed: ${err.message}`);
  process.exit(1);
});
