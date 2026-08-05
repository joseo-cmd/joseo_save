import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";

const { default: app } = await import("../src/index.js");

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

test("health endpoint reports ok", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "joseo_save");
});

test("create, list, and delete an item", async () => {
  const createRes = await fetch(`${baseUrl}/api/items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Cursor", url: "https://cursor.com" }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.title, "Cursor");
  assert.ok(created.id);

  const listRes = await fetch(`${baseUrl}/api/items`);
  const items = await listRes.json();
  assert.ok(items.some((item) => item.id === created.id));

  const delRes = await fetch(`${baseUrl}/api/items/${created.id}`, { method: "DELETE" });
  assert.equal(delRes.status, 204);

  const afterList = await (await fetch(`${baseUrl}/api/items`)).json();
  assert.ok(!afterList.some((item) => item.id === created.id));
});

test("creating an item without a title fails", async () => {
  const res = await fetch(`${baseUrl}/api/items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  assert.equal(res.status, 400);
});
