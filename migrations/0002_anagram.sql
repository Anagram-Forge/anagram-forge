create table if not exists saved_queries (
  id serial primary key,
  user_id text not null,
  label text not null,
  letters text not null,
  mode text not null,
  pattern text not null default '',
  dict_tier text not null default 'standard',
  created_at timestamptz not null default now()
);
create index if not exists saved_queries_user_id_idx on saved_queries (user_id);

create table if not exists favorite_words (
  id serial primary key,
  user_id text not null,
  word text not null,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);
create index if not exists favorite_words_user_id_idx on favorite_words (user_id);
