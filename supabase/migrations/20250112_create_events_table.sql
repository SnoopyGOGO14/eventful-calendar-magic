-- Create events table
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  date text not null,
  title text not null,
  status text default 'pending',
  is_recurring boolean default false,
  room text,
  promoter text,
  capacity text,
  _sheet_line_number integer,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add RLS policies
alter table public.events enable row level security;

-- Create policy to allow all users to read events
create policy "Allow public read access"
  on public.events
  for select
  using (true);

-- Create policy to allow authenticated users to insert/update events
create policy "Allow authenticated users to manage events"
  on public.events
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Create function to automatically update updated_at on row update
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create trigger to automatically update updated_at
create trigger handle_updated_at
  before update
  on public.events
  for each row
  execute function public.handle_updated_at();
