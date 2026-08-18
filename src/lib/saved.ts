import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type SavedQuery = {
  id: number;
  label: string;
  letters: string;
  mode: string;
  pattern: string;
  dictTier: string;
  createdAt: string;
};

export type FavoriteWord = {
  id: number;
  word: string;
  createdAt: string;
};

export const listSavedQueries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      label: string;
      letters: string;
      mode: string;
      pattern: string;
      dict_tier: string;
      created_at: string;
    }>`
      select id, label, letters, mode, pattern, dict_tier, created_at
      from saved_queries
      where user_id = ${context.userId}
      order by id desc
    `;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      letters: r.letters,
      mode: r.mode,
      pattern: r.pattern,
      dictTier: r.dict_tier,
      createdAt: r.created_at,
    })) satisfies SavedQuery[];
  });

export const addSavedQuery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { label: string; letters: string; mode: string; pattern: string; dictTier: string }) => ({
    label: input.label.trim().slice(0, 80),
    letters: input.letters.trim().slice(0, 80),
    mode: input.mode.slice(0, 20),
    pattern: input.pattern.trim().slice(0, 40),
    dictTier: input.dictTier.slice(0, 20),
  }))
  .handler(async ({ context, data }) => {
    if (!data.label || !data.letters) return null;
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into saved_queries (user_id, label, letters, mode, pattern, dict_tier)
      values (${context.userId}, ${data.label}, ${data.letters}, ${data.mode}, ${data.pattern}, ${data.dictTier})
      returning id
    `;
    return rows[0]?.id ?? null;
  });

export const deleteSavedQuery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from saved_queries where id = ${id} and user_id = ${context.userId}`;
  });

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number; word: string; created_at: string }>`
      select id, word, created_at from favorite_words
      where user_id = ${context.userId}
      order by word asc
    `;
    return rows.map((r) => ({
      id: r.id,
      word: r.word,
      createdAt: r.created_at,
    })) satisfies FavoriteWord[];
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((word: string) => word.trim().toLowerCase().slice(0, 32))
  .handler(async ({ context, data: word }) => {
    if (!word) return { favorited: false };
    const sql = await getSql();
    const existing = await sql<{ id: number }>`
      select id from favorite_words where user_id = ${context.userId} and word = ${word}
    `;
    if (existing[0]) {
      await sql`delete from favorite_words where id = ${existing[0].id} and user_id = ${context.userId}`;
      return { favorited: false };
    }
    await sql`insert into favorite_words (user_id, word) values (${context.userId}, ${word})`;
    return { favorited: true };
  });
