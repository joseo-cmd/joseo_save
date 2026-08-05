import cors from "cors";
import express from "express";

import { createItem, deleteItem, listItems } from "./store.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "joseo_save", time: new Date().toISOString() });
});

app.get("/api/items", (_req, res) => {
  res.json(listItems());
});

app.post("/api/items", (req, res) => {
  try {
    const item = createItem(req.body ?? {});
    res.status(201).json(item);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.delete("/api/items/:id", (req, res) => {
  const removed = deleteItem(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.status(204).end();
});

// Only listen when run directly, so the app can be imported in tests.
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[joseo_save] API listening on http://localhost:${PORT}`);
  });
}

export default app;
