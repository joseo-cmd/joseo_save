import { FormEvent, useEffect, useState } from "react";

import { createItem, deleteItem, listItems, type SavedItem } from "./api";

export default function App() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setItems(await listItems());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    try {
      await createItem({ title, url });
      setTitle("");
      setUrl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteItem(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">joseo_save</h1>
        <p className="app__subtitle">Save links and notes you want to keep.</p>
      </header>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="form__row">
          <label className="form__field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cursor docs"
              aria-label="Title"
            />
          </label>
          <label className="form__field">
            <span>URL or note</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-label="URL or note"
            />
          </label>
        </div>
        <button className="button" type="submit">
          Save
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <section className="list">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="muted">Nothing saved yet. Add your first item above.</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="card item">
              <div className="item__body">
                <h2 className="item__title">{item.title}</h2>
                {item.url &&
                  (item.url.startsWith("http") ? (
                    <a className="item__url" href={item.url} target="_blank" rel="noreferrer">
                      {item.url}
                    </a>
                  ) : (
                    <p className="item__note">{item.url}</p>
                  ))}
                <time className="item__time">{new Date(item.createdAt).toLocaleString()}</time>
              </div>
              <button
                className="button button--ghost"
                onClick={() => handleDelete(item.id)}
                aria-label={`Delete ${item.title}`}
              >
                Delete
              </button>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
