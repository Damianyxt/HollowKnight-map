import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Hollow Knight map shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>空洞骑士地图<\/title>/i);
  assert.match(html, /<main class="map-viewport" aria-label="空洞骑士地图">/);
  assert.match(html, /class="map-filter-panel"/);
  assert.match(html, /aria-label="收起筛选栏" aria-expanded="true"/);
  assert.match(html, /src="\/assets\/hallownest-map\.png"/);
  assert.match(html, /aria-label="选择空洞骑士存档目录"/);
});

test("keeps the map page wired to its dedicated viewer and theme", async () => {
  const [page, layout, viewer, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MapViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import MapViewer from "\.\/MapViewer"/);
  assert.match(page, /return <MapViewer \/>/);
  assert.match(layout, /title:\s*"空洞骑士地图"/);
  assert.match(layout, /description:\s*"空洞骑士互动攻略地图"/);
  assert.match(viewer, /\[filterCollapsed, setFilterCollapsed\] = useState\(false\)/);
  assert.match(viewer, /className=\{`map-viewport\$\{/);
  assert.match(css, /--hk-choice-active-border:\s*#72e9ff/);
  assert.match(css, /\.marker-popup-content\s*\{[^}]*overflow-x:\s*hidden/s);
});
