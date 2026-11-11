/** Nutrition for one serving, as printed on the NetNutrition label. null = "NA" on the label. */
export interface Nutrition {
  servingSize: string; // e.g. "Patty (91g)"
  servingGrams: number | null;
  calories: number | null;
  protein: number | null; // g
  totalCarbs: number | null; // g
  totalFat: number | null; // g
  saturatedFat: number | null; // g
  transFat: number | null; // g
  fiber: number | null; // g
  sugars: number | null; // g
  cholesterol: number | null; // mg
  sodium: number | null; // mg
}

export interface MenuItem {
  name: string;
  station: string;
  course: string; // e.g. "Entrees", "Starches"
  servingSize: string; // as listed on the menu row, e.g. "1/2 Cup"
  traits: string[]; // allergens + diet tags, e.g. ["Soy", "Vegan"]
  nutrition: Nutrition | null;
}

export interface MealPeriod {
  meal: string; // "Breakfast" | "Lunch" | "Dinner" | ...
  start: string | null; // "7:00" (24h, America/Chicago)
  end: string | null;
  items: MenuItem[];
}

export interface HallMenu {
  id: string; // our slug, e.g. "isr"
  name: string;
  meals: MealPeriod[];
}

export interface DayMenu {
  date: string; // YYYY-MM-DD
  scrapedAt: string; // ISO timestamp
  source: string;
  halls: HallMenu[];
}
