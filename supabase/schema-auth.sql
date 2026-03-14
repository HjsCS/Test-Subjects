-- ============================================================
-- MoodBubble — Auth, Profiles & Friends Schema
-- Run AFTER the base schema.sql in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for searching users by display name
create index idx_profiles_display_name on profiles (display_name);

-- Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function public.update_updated_at();

-- ============================================================
-- 2. FRIENDSHIPS TABLE
-- ============================================================
create type friendship_status as enum ('pending', 'accepted', 'rejected');

create table public.friendships (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Prevent duplicate requests in either direction
  constraint unique_friendship unique (requester_id, addressee_id),
  -- Can't friend yourself
  constraint no_self_friendship check (requester_id != addressee_id)
);

create index idx_friendships_requester on friendships (requester_id, status);
create index idx_friendships_addressee on friendships (addressee_id, status);

create trigger friendships_updated_at
  before update on friendships
  for each row execute function public.update_updated_at();

-- ============================================================
-- 3. HELPER FUNCTION: are_friends(uuid, uuid) -> boolean
-- ============================================================
create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = user_a and addressee_id = user_b)
        or
        (requester_id = user_b and addressee_id = user_a)
      )
  );
$$ language sql security definer stable;

-- ============================================================
-- 4. MIGRATE mood_entries.user_id FROM text TO uuid
-- ============================================================

-- Step 1: Remove old permissive policy
drop policy if exists "Allow all for MVP" on mood_entries;

-- Step 2: Delete orphan anonymous rows (test/seed data)
delete from mood_entries where user_id = 'anonymous';

-- Step 3: Alter column type
alter table mood_entries
  alter column user_id type uuid using user_id::uuid;

-- Step 4: Add foreign key constraints
-- FK to auth.users for RLS and auth integrity
alter table mood_entries
  add constraint fk_mood_entries_user
  foreign key (user_id) references auth.users(id) on delete cascade;

-- FK to profiles so PostgREST can join mood_entries → profiles
alter table mood_entries
  add constraint fk_mood_entries_profile
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ============================================================
-- 5. RLS POLICIES — profiles
-- ============================================================
alter table profiles enable row level security;

-- Anyone authenticated can read any profile (for friend search, display)
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- 6. RLS POLICIES — mood_entries (replace old permissive policy)
-- ============================================================

-- Owner can do everything with their own entries
create policy "Users can CRUD own mood entries"
  on mood_entries for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Friends can SELECT entries with visibility='friends'
create policy "Friends can view friends-visible entries"
  on mood_entries for select
  to authenticated
  using (
    visibility = 'friends'
    and public.are_friends(auth.uid(), user_id)
  );

-- ============================================================
-- 7. RLS POLICIES — friendships
-- ============================================================
alter table friendships enable row level security;

-- Users can see friendships they're part of
create policy "Users can view own friendships"
  on friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Users can insert a request (as the requester)
create policy "Users can send friend requests"
  on friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

-- Users can update friendships addressed to them (accept/reject)
create policy "Addressee can respond to friend requests"
  on friendships for update
  to authenticated
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Either party can delete a friendship
create policy "Either party can remove friendship"
  on friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
