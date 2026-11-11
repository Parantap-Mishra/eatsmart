export const NETNUTRITION_BASE = 'http://eatsmart.housing.illinois.edu/NetNutrition/46';
export const HOURS_PAGE = 'https://web.housing.illinois.edu/diningmenus';

/** Identify ourselves honestly. Never pretend to be a browser. */
export const USER_AGENT = 'EatSmartScraper/0.1 (student project; +https://github.com/Parantap-Mishra/eatsmart)';

/** Pause between requests to UIUC servers. */
export const REQUEST_DELAY_MS = 1000;
export const REQUEST_TIMEOUT_MS = 20_000;

/** The 4 all-you-care-to-eat halls. IDs differ between the two UIUC systems. */
export const HALLS = [
  { id: 'ikenberry', name: 'Ikenberry Dining Center', nnUnitOid: 1, hoursId: 1 },
  { id: 'isr', name: 'ISR Dining Center', nnUnitOid: 11, hoursId: 3 },
  { id: 'par', name: 'PAR Dining Hall', nnUnitOid: 22, hoursId: 2 },
  { id: 'lar', name: 'Lincoln/Allen Dining Hall', nnUnitOid: 29, hoursId: 5 },
] as const;

export type Hall = (typeof HALLS)[number];
