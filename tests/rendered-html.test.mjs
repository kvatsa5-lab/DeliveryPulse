/**
 * Server-render checks for the Delivery Pulse shell.
 *
 * This file previously asserted that the repo was still the unmodified vinext
 * starter -- it required app/_sites-preview/SkeletonPreview.tsx (never present in
 * this repo), a layout titled "Starter Project", and a "Your site is taking
 * shape" placeholder page. Those assertions could not pass once the starter was
 * replaced by Delivery Pulse, so the suite was permanently red and gave no signal.
 *
 * The checks below target behaviour that matters for a signed-out first paint:
 * the shell renders, navigation is reachable, no identity leaks into the HTML,
 * and placeholder content is hidden from assistive technology. They deliberately
 * avoid asserting exact class names or copy, so ordinary UI edits do not break
 * the suite.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { NAV_ITEMS } from "../lib/constants/statuses.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${performance.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("serves the app shell as HTML", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*Delivery Pulse[^<]*<\/title>/i);
  assert.match(html, /<html lang="en"/);
});

test("renders every navigation section in an accessible landmark", async () => {
  const html = await (await render()).text();

  assert.match(html, /<nav aria-label="Sections">/);
  for (const item of NAV_ITEMS) {
    assert.ok(html.includes(`>${item}<`), `nav is missing "${item}"`);
  }
});

test("marks exactly one navigation item as current", async () => {
  const html = await (await render()).text();
  const current = html.match(/aria-current="page"/g) ?? [];
  assert.equal(
    current.length,
    1,
    "more than one current section confuses screen reader users"
  );
});

test("hides placeholder skeletons from assistive technology", async () => {
  const html = await (await render()).text();

  assert.match(html, /class="skeleton/, "expected loading placeholders on first paint");
  // Skeletons carry no information, so their container must not be announced.
  assert.match(html, /<div class="metrics" aria-hidden="true">/);
});

test("renders a signed-out identity, never a hardcoded person", async () => {
  const html = await (await render()).text();

  // The server render has no ChatGPT identity headers, so the sidebar must show
  // the signed-out state. The sidebar previously hardcoded "KV"/"Kshitij Vatsa",
  // which showed a real name to whoever loaded the page.
  assert.match(html, /Signed out/);
  assert.doesNotMatch(html, /Kshitij Vatsa/i);
  assert.doesNotMatch(html, /@sonatype\.com/i);
});

test("does not leak unresolved values into the markup", async () => {
  const html = await (await render()).text();

  for (const leak of ["undefined", "NaN", "[object Object]"]) {
    assert.ok(!html.includes(`>${leak}<`), `rendered a raw "${leak}" into the page`);
  }
});

test("first paint does not claim data it has not loaded", async () => {
  const html = await (await render()).text();

  // With no records fetched yet the signal band must read zero rather than
  // inventing counts -- the Insights bars used to be hardcoded percentages.
  assert.match(html, /engagements are tracked/);
  assert.doesNotMatch(html, /aria-current="page"[^>]*>My work</);
});
