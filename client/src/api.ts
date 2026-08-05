export interface SavedItem {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listItems(): Promise<SavedItem[]> {
  return fetch("/api/items").then((res) => handle<SavedItem[]>(res));
}

export function createItem(input: { title: string; url: string }): Promise<SavedItem> {
  return fetch("/api/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handle<SavedItem>(res));
}

export function deleteItem(id: string): Promise<void> {
  return fetch(`/api/items/${id}`, { method: "DELETE" }).then((res) => handle<void>(res));
}
