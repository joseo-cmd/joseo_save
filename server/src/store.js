import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "items.json");

function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readAll() {
  ensureStore();
  try {
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  ensureStore();
  writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

export function listItems() {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createItem({ title, url }) {
  const trimmedTitle = (title ?? "").trim();
  if (!trimmedTitle) {
    throw Object.assign(new Error("title is required"), { status: 400 });
  }
  const item = {
    id: randomUUID(),
    title: trimmedTitle,
    url: (url ?? "").trim(),
    createdAt: new Date().toISOString(),
  };
  const items = readAll();
  items.push(item);
  writeAll(items);
  return item;
}

export function deleteItem(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  const removed = next.length !== items.length;
  if (removed) {
    writeAll(next);
  }
  return removed;
}
