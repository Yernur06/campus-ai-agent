import * as SQLite from 'expo-sqlite';

export type SavedPost = {
  id: number;
  title: string;
  body: string;
  isRead: 0 | 1;
};

export type PostInput = Pick<SavedPost, 'id' | 'title' | 'body'>;

const readyDb = SQLite.openDatabaseAsync('campus_favorites.db').then(async (db) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      isRead INTEGER NOT NULL DEFAULT 0 CHECK (isRead IN (0, 1))
    );
  `);

  return db;
});

export async function savePost(post: PostInput): Promise<number> {
  const db = await readyDb;
  const result = await db.runAsync(
    'INSERT INTO favorites (id, title, body) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING',
    [post.id, post.title, post.body]
  );

  return Number(result.changes ?? 0);
}

export async function getSavedPosts(): Promise<SavedPost[]> {
  const db = await readyDb;
  const rows = await db.getAllAsync<SavedPost>(
    'SELECT id, title, body, isRead FROM favorites ORDER BY isRead ASC, id DESC'
  );

  return rows.map((row) => ({
    ...row,
    isRead: Number(row.isRead) === 1 ? 1 : 0
  }));
}

export async function toggleRead(id: number): Promise<void> {
  const db = await readyDb;
  await db.runAsync('UPDATE favorites SET isRead = 1 - isRead WHERE id = ?', [id]);
}

export async function removeSaved(id: number): Promise<void> {
  const db = await readyDb;
  await db.runAsync('DELETE FROM favorites WHERE id = ?', [id]);
}
