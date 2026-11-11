/**
 * Pure parsers for UIUC's dining pages. No network here, so everything is
 * unit-tested against saved real responses in test/fixtures/.
 * If UIUC changes their pages, these throw SiteChangedError instead of
 * silently returning nothing.
 */
import * as cheerio from 'cheerio';
import type { Nutrition } from './types.js';

export class SiteChangedError extends Error {
  constructor(what: string) {
    super(`UIUC dining site format changed? ${what}`);
    this.name = 'SiteChangedError';
  }
}

/** NetNutrition AJAX responses look like {success, panels: [{id, html}]}. */
export function parsePanels(json: string): Record<string, string> {
  if (/Start-up Error/i.test(json)) throw new SiteChangedError('NetNutrition returned its start-up error page');
  let data: { success?: boolean; panels?: { id: string; html: string }[] };
  try {
    data = JSON.parse(json);
  } catch {
    throw new SiteChangedError('NetNutrition response was not JSON');
  }
  if (!data.success || !Array.isArray(data.panels)) throw new SiteChangedError('NetNutrition response missing panels');
  return Object.fromEntries(data.panels.map((p) => [p.id, p.html]));
}

/** Stations inside a hall: `childUnitsSelectUnit(15)">Grillworks`. */
export function parseChildUnits(html: string): { oid: number; name: string }[] {
  const $ = cheerio.load(html);
  const out: { oid: number; name: string }[] = [];
  $('a[onclick*="childUnitsSelectUnit("]').each((_, a) => {
    const m = /childUnitsSelectUnit\((\d+)\)/.exec($(a).attr('onclick') ?? '');
    if (m) out.push({ oid: Number(m[1]), name: $(a).text().trim() });
  });
  return out;
}

/** "2026-11-10" -> "Tuesday, November 10, 2026" (NetNutrition's date headers). */
export function formatDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** A station's menu list -> the meal menus for one date. */
export function parseMenuList(html: string, isoDate: string): { meal: string; menuOid: number }[] {
  const $ = cheerio.load(html);
  const header = formatDateHeader(isoDate);
  const out: { meal: string; menuOid: number }[] = [];
  $('header.card-title').each((_, h) => {
    if ($(h).text().trim() !== header) return;
    $(h).closest('.card-block').find('a.cbo_nn_menuLink').each((_, a) => {
      const m = /menuListSelectMenu\((\d+)\)/.exec($(a).attr('onclick') ?? '');
      if (m) out.push({ meal: $(a).text().trim(), menuOid: Number(m[1]) });
    });
  });
  return out;
}

export interface MenuRow {
  detailOid: number;
  name: string;
  course: string;
  servingSize: string;
  traits: string[];
}

/** One meal's item table. Course header rows are followed by item rows. */
export function parseMenuItems(html: string): MenuRow[] {
  const $ = cheerio.load(html);
  const out: MenuRow[] = [];
  let course = '';
  $('tr').each((_, tr) => {
    const row = $(tr);
    if (row.hasClass('cbo_nn_itemGroupRow')) {
      course = row.text().trim();
      return;
    }
    if (!row.hasClass('cbo_nn_itemPrimaryRow') && !row.hasClass('cbo_nn_itemAlternateRow')) return;
    const link = row.find('a[id^="showNutrition_"]').first();
    const oid = Number((link.attr('id') ?? '').replace('showNutrition_', ''));
    if (!oid) return;
    const traits = link.find('img').map((_, img) => $(img).attr('title') ?? '').get().filter(Boolean);
    const name = link.clone().children().remove().end().text().trim();
    const servingSize = row.children('td').eq(2).text().trim();
    out.push({ detailOid: oid, name, course, servingSize, traits });
  });
  return out;
}

/** Turns "9g", "<1g", "NA", "440mg" into numbers ("<1" counts as 0.5). */
function num(raw: string | undefined): number | null {
  if (!raw || /NA/i.test(raw)) return null;
  if (raw.trim().startsWith('<')) return 0.5;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Nutrition label HTML -> numbers. */
export function parseLabel(html: string): Nutrition {
  const text = cheerio.load(html).text().replace(/ /g, ' ').replace(/\s+/g, ' ');
  if (!/Nutrition Information/i.test(text) || !/Calories/.test(text)) {
    throw new SiteChangedError('nutrition label has no calories');
  }
  const grab = (label: string) => new RegExp(`${label}\\s+(<?\\s*[\\d.]+|NA)`).exec(text)?.[1];
  const servingSize = /Serving Size:\s*(.*?)\s*Amount Per Serving/.exec(text)?.[1]?.trim() ?? '';
  const grams = /\((\d+(?:\.\d+)?)\s*g\)/.exec(servingSize)?.[1];
  return {
    servingSize,
    servingGrams: grams ? Number(grams) : null,
    calories: num(grab('Calories')),
    protein: num(grab('Protein')),
    totalCarbs: num(grab('Total Carbohydrate')),
    totalFat: num(grab('Total Fat')),
    saturatedFat: num(grab('Saturated Fat')),
    transFat: num(grab('Trans Fat')),
    fiber: num(grab('Dietary Fiber')),
    sugars: num(grab('Sugars')),
    cholesterol: num(grab('Cholesterol')),
    sodium: num(grab('Sodium')),
  };
}

export interface HoursRow {
  hoursId: number;
  meal: string;
  start: string;
  end: string;
}

/** The hidden #sTable on the UIUC dining menus page. */
export function parseHours(html: string, isoDate: string): HoursRow[] {
  const $ = cheerio.load(html);
  const table = $('#sTable');
  if (!table.length) throw new SiteChangedError('hours table #sTable not found');
  const out: HoursRow[] = [];
  table.find('tbody tr').each((_, tr) => {
    const c = $(tr).children('td').map((_, td) => $(td).text().trim()).get();
    if (c[1] === isoDate) out.push({ hoursId: Number(c[0]), meal: c[3], start: c[4], end: c[5] });
  });
  return out;
}

/** For matching the same dish across meals: case, spacing and punctuation-insensitive. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}
