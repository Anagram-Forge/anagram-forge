-- Anagram Forge. Run once against the D1 database.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  letters TEXT NOT NULL,
  mode TEXT NOT NULL,
  created INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS finds (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  phrase TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  UNIQUE (week_id, phrase),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS votes (
  find_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (find_id, user_id),
  FOREIGN KEY (find_id) REFERENCES finds(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bans (
  handle TEXT PRIMARY KEY COLLATE NOCASE,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge (
  k TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  blurb TEXT NOT NULL,
  rack TEXT NOT NULL,
  mode TEXT NOT NULL
);
