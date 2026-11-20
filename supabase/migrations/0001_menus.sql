-- 0001: dining halls, dishes (with nutrition), daily menus and hours.
-- Paste into Supabase Dashboard > SQL Editor > Run. Safe to run once on an empty project.

-- The 4 all-you-care-to-eat halls.
create table halls (
  id text primary key,                 -- our slug: 'isr', 'par', ...
  name text not null,
  netnutrition_unit_oid int not null,  -- hall ID on eatsmart.housing.illinois.edu
  hours_id int not null                -- hall ID on web.housing.illinois.edu
);

insert into halls (id, name, netnutrition_unit_oid, hours_id) values
  ('ikenberry', 'Ikenberry Dining Center', 1, 1),
  ('isr', 'ISR Dining Center', 11, 3),
  ('par', 'PAR Dining Hall', 22, 2),
  ('lar', 'Lincoln/Allen Dining Hall', 29, 5);

-- A dish = one item at one serving size. Nutrition is stored once, reused every day it's served.
create table dishes (
  id bigint generated always as identity primary key,
  key text not null unique,            -- normalized "name|serving size", matches the scraper cache key
  name text not null,
  serving_size text not null,          -- "Patty (91g)"
  serving_grams numeric,
  traits text[] not null default '{}', -- allergens + diet tags: {Soy,Vegan,...}
  calories numeric,                    -- all nutrition columns are per 1 serving; null = UIUC has no data
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  saturated_fat_g numeric,
  trans_fat_g numeric,
  fiber_g numeric,
  sugars_g numeric,
  cholesterol_mg numeric,
  sodium_mg numeric,
  updated_at timestamptz not null default now()
);

-- What is served where and when. One row per dish per hall per period per day.
create table menu_items (
  id bigint generated always as identity primary key,
  date date not null,
  hall_id text not null references halls (id),
  period text not null,                -- 'Breakfast' | 'Lunch' | 'Dinner' | ... or an all-day section like 'Salad Bar'
  is_all_day boolean not null,         -- true = available whenever the hall is open
  station text not null,               -- 'Grillworks'
  course text not null,                -- 'Entrees'
  dish_id bigint not null references dishes (id),
  unique (date, hall_id, period, station, dish_id)
);
create index menu_items_date_hall on menu_items (date, hall_id);

-- Meal hours per hall per day (America/Chicago local time).
create table meal_hours (
  date date not null,
  hall_id text not null references halls (id),
  meal text not null,
  start_time time not null,
  end_time time not null,
  primary key (date, hall_id, meal)
);

-- Row level security: anyone (the app) can READ menus. Nobody can write with the
-- public key. The scraper writes with the secret key, which bypasses RLS.
alter table halls enable row level security;
alter table dishes enable row level security;
alter table menu_items enable row level security;
alter table meal_hours enable row level security;

create policy "public read" on halls for select using (true);
create policy "public read" on dishes for select using (true);
create policy "public read" on menu_items for select using (true);
create policy "public read" on meal_hours for select using (true);

-- Expose the tables to the Data API explicitly (works whether or not the project
-- "grant API access to new tables automatically" setting is on).
-- anon/authenticated = the app (read only, still filtered by RLS above).
-- service_role = the scraper's secret key (full access).
grant select on halls, dishes, menu_items, meal_hours to anon, authenticated;
grant all on halls, dishes, menu_items, meal_hours to service_role;
grant usage, select on all sequences in schema public to service_role;
