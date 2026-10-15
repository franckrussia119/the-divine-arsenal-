-- =====================================================================
--  THE DIVINE ARSENAL CORPORATION · École de disciples
--  Base de données Supabase : à coller UNE FOIS dans « SQL Editor » puis « Run ».
--  Rôles : student (élève), admin (mentor de classe), superadmin.
--  Le tout premier compte créé devient automatiquement superadmin.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  mentor_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student','admin','superadmin')),
  class_id uuid references public.classes(id) on delete set null,
  mentor_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.classes drop constraint if exists classes_mentor_fk;
alter table public.classes add constraint classes_mentor_fk foreign key (mentor_id) references public.profiles(id) on delete set null;

-- Déblocage d'une leçon pour toute une classe (class_id) ou pour un élève (student_id)
create table if not exists public.unlocks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  lesson text not null,
  unlocked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((class_id is null) <> (student_id is null))
);
create unique index if not exists unlocks_class_lesson on public.unlocks(class_id, lesson) where class_id is not null;
create unique index if not exists unlocks_student_lesson on public.unlocks(student_id, lesson) where student_id is not null;

-- Réponses du cahier : un document JSON par élève et par leçon
create table if not exists public.answers (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson text not null,
  data jsonb not null default '{}'::jsonb,
  submitted boolean not null default false,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson)
);

-- Corrections du mentor
create table if not exists public.reviews (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson text not null,
  items jsonb not null default '{}'::jsonb,   -- { "A1": {"ok": true, "comment": "..."}, ... }
  general text not null default '',
  validated boolean not null default false,
  mentor_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson)
);

-- Tests de fin de leçon
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson text not null,
  score int not null,
  total int not null,
  detail jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Questions et commentaires sur une question précise du cahier
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson text not null,
  item_key text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  read_by_student boolean not null default false,
  read_by_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_student on public.messages(student_id, lesson);

-- ---------- Fonctions d'aide (security definer : évitent la récursion RLS) ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid() and active), false)
$$;

-- Vrai si l'utilisateur connecté est le mentor de cet élève, ou superadmin
create or replace function public.is_staff_for(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.profiles p join public.profiles me on me.id = auth.uid()
    where p.id = target and p.mentor_id = me.id and me.active and me.role in ('admin','superadmin'))
$$;

create or replace function public.is_mentor_of_class(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.classes c join public.profiles me on me.id = c.mentor_id
    where c.id = cid and me.id = auth.uid() and me.active and me.role in ('admin','superadmin'))
$$;

-- ---------- Création du profil à l'inscription (avec le code de classe) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(new.raw_user_meta_data->>'class_code', '')));
  v_class uuid;
  v_mentor uuid;
  v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;
  if not v_first then
    select id, mentor_id into v_class, v_mentor from public.classes where upper(code) = v_code;
    if v_class is null then
      raise exception 'Code de classe invalide';
    end if;
  end if;
  insert into public.profiles (id, username, full_name, role, class_id, mentor_id)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          case when v_first then 'superadmin' else 'student' end,
          v_class, v_mentor);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un élève ou un mentor ne peut pas changer lui-même son rôle, sa classe ou son statut
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    if new.role is distinct from old.role or new.active is distinct from old.active or new.username is distinct from old.username
       or new.mentor_id is distinct from old.mentor_id then
      raise exception 'Action réservée au superadmin';
    end if;
    if new.class_id is distinct from old.class_id and not (public.is_mentor_of_class(new.class_id) and public.is_mentor_of_class(old.class_id)) then
      raise exception 'Changement de classe non autorisé';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- Le superadmin (ou le mentor de la classe) peut redéfinir le mot de passe d'un élève
create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(new_password) < 6 then raise exception 'Mot de passe trop court (6 caractères minimum)'; end if;
  if not (public.is_superadmin() or (public.is_staff_for(target) and (select role from public.profiles where id = target) = 'student')) then
    raise exception 'Non autorisé';
  end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now() where id = target;
end $$;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- Vérification du code de classe avant l'inscription (renvoie seulement vrai/faux)
create or replace function public.check_class_code(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles) or exists (select 1 from public.classes where upper(code) = upper(trim(c)))
$$;
grant execute on function public.check_class_code(text) to anon, authenticated;

-- ---------- Sécurité ligne par ligne (RLS) ----------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.unlocks enable row level security;
alter table public.answers enable row level security;
alter table public.reviews enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.messages enable row level security;

-- profils
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff_for(id) or role in ('admin','superadmin')
         or (public.my_role() = 'admin' and class_id is not null and public.is_mentor_of_class(class_id)));
drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff_for(id)) with check (id = auth.uid() or public.is_staff_for(id));
drop policy if exists p_profiles_delete on public.profiles;
create policy p_profiles_delete on public.profiles for delete to authenticated using (public.is_superadmin());

-- classes
drop policy if exists p_classes_select on public.classes;
create policy p_classes_select on public.classes for select to authenticated
  using (public.my_role() in ('admin','superadmin') or id = (select class_id from public.profiles where id = auth.uid()));
drop policy if exists p_classes_write on public.classes;
create policy p_classes_write on public.classes for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- déblocages
drop policy if exists p_unlocks_select on public.unlocks;
create policy p_unlocks_select on public.unlocks for select to authenticated
  using (student_id = auth.uid()
      or class_id = (select class_id from public.profiles where id = auth.uid())
      or (class_id is not null and public.is_mentor_of_class(class_id))
      or (student_id is not null and public.is_staff_for(student_id)));
drop policy if exists p_unlocks_write on public.unlocks;
create policy p_unlocks_write on public.unlocks for all to authenticated
  using ((class_id is not null and public.is_mentor_of_class(class_id)) or (student_id is not null and public.is_staff_for(student_id)))
  with check ((class_id is not null and public.is_mentor_of_class(class_id)) or (student_id is not null and public.is_staff_for(student_id)));

-- réponses
drop policy if exists p_answers_select on public.answers;
create policy p_answers_select on public.answers for select to authenticated
  using (student_id = auth.uid() or public.is_staff_for(student_id));
drop policy if exists p_answers_insert on public.answers;
create policy p_answers_insert on public.answers for insert to authenticated with check (student_id = auth.uid());
drop policy if exists p_answers_update on public.answers;
create policy p_answers_update on public.answers for update to authenticated
  using (student_id = auth.uid() or public.is_staff_for(student_id)) with check (student_id = auth.uid() or public.is_staff_for(student_id));

-- corrections
drop policy if exists p_reviews_select on public.reviews;
create policy p_reviews_select on public.reviews for select to authenticated
  using (student_id = auth.uid() or public.is_staff_for(student_id));
drop policy if exists p_reviews_write on public.reviews;
create policy p_reviews_write on public.reviews for all to authenticated
  using (public.is_staff_for(student_id)) with check (public.is_staff_for(student_id));

-- tests
drop policy if exists p_quiz_select on public.quiz_attempts;
create policy p_quiz_select on public.quiz_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_staff_for(student_id));
drop policy if exists p_quiz_insert on public.quiz_attempts;
create policy p_quiz_insert on public.quiz_attempts for insert to authenticated with check (student_id = auth.uid());

-- messages
drop policy if exists p_msg_select on public.messages;
create policy p_msg_select on public.messages for select to authenticated
  using (student_id = auth.uid() or public.is_staff_for(student_id));
drop policy if exists p_msg_insert on public.messages;
create policy p_msg_insert on public.messages for insert to authenticated
  with check (author_id = auth.uid() and (student_id = auth.uid() or public.is_staff_for(student_id)));
drop policy if exists p_msg_update on public.messages;
create policy p_msg_update on public.messages for update to authenticated
  using (student_id = auth.uid() or public.is_staff_for(student_id)) with check (student_id = auth.uid() or public.is_staff_for(student_id));
