-- =============================================
-- ВСТАВЬ ЭТОТ КОД В SUPABASE SQL EDITOR
-- Project Settings → SQL Editor → New query
-- =============================================

-- 1. Таблица рецептов
create table recipes (
  id          bigserial primary key,
  user_id     uuid references auth.users not null,
  name        text not null,
  emoji       text,
  category    text not null default 'lunch',
  cook_time   integer,
  description text,
  created_at  timestamptz default now()
);

-- 2. Таблица ингредиентов
create table ingredients (
  id          bigserial primary key,
  recipe_id   bigint references recipes(id) on delete cascade,
  name        text not null,
  amount      text
);

-- 3. Таблица плана питания
create table plan_entries (
  id          bigserial primary key,
  user_id     uuid references auth.users not null,
  date        date not null,
  meal_type   text not null,
  recipe_id   bigint references recipes(id) on delete cascade,
  created_at  timestamptz default now()
);

-- =============================================
-- ДОСТУП: любой залогиненный видит все данные
-- (это нужно чтобы ты и жена делили рецепты)
-- =============================================

alter table recipes      enable row level security;
alter table ingredients  enable row level security;
alter table plan_entries enable row level security;

-- Рецепты: видят все залогиненные, редактирует только создатель
create policy "all users can read recipes"
  on recipes for select using (auth.role() = 'authenticated');

create policy "owner can insert recipes"
  on recipes for insert with check (auth.uid() = user_id);

create policy "owner can update recipes"
  on recipes for update using (auth.uid() = user_id);

create policy "owner can delete recipes"
  on recipes for delete using (auth.uid() = user_id);

-- Ингредиенты: следуют за рецептом
create policy "all users can read ingredients"
  on ingredients for select using (auth.role() = 'authenticated');

create policy "recipe owner can manage ingredients"
  on ingredients for all using (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );

-- План: видят все, управляет тот кто создал запись
create policy "all users can read plan"
  on plan_entries for select using (auth.role() = 'authenticated');

create policy "user can insert plan entries"
  on plan_entries for insert with check (auth.uid() = user_id);

create policy "user can delete own plan entries"
  on plan_entries for delete using (auth.uid() = user_id);
