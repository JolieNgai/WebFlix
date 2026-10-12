import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

function setup() {
  const notices = [];
  let handler;
  const context = {
    window: { WEBFLIX_API_BASE: "", location: { origin: "http://localhost:5500" } },
    document: { addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem() { return "test-token"; } },
    alert(message) { notices.push(message); },
    fetch(...args) { return handler(...args); },
    console, URL, URLSearchParams
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../js/movies.js", import.meta.url), "utf8"), context);
  const attributes = {};
  const button = { disabled: false, textContent: "", title: "", classList: { toggle() {} }, setAttribute(key,value) { attributes[key]=value; } };
  context.button = button;
  return { context, button, notices, attributes, setFetch(fn) { handler = fn; } };
}

test("saved button state restores from the API and a failed removal preserves it", async () => {
  const s = setup();
  s.setFetch(async () => ({ ok: true, json: async () => [{ movie_id: "abc" }] }));
  await vm.runInContext("loadSavedMovieIds()", s.context);
  vm.runInContext('updateWatchlistButton(button, "abc")', s.context);
  assert.equal(s.attributes["aria-pressed"], "true");
  assert.equal(s.button.textContent, "Saved to watchlist");
  s.setFetch(async () => ({ ok: false, status: 500, json: async () => ({ message: "Server unavailable" }) }));
  await vm.runInContext('addToWatchlist("abc", "Movie", button)', s.context);
  assert.equal(s.attributes["aria-pressed"], "true");
  assert.equal(s.button.disabled, false);
  assert.equal(s.notices[0], "Server unavailable");
});

test("save and remove use correct methods, wait for success, and block duplicate clicks", async () => {
  const s = setup();
  s.setFetch(async () => ({ ok: true, json: async () => [] }));
  await vm.runInContext("loadSavedMovieIds()", s.context);
  let complete;
  let calls=0;
  s.setFetch((url, options) => {
    calls++;
    assert.equal(options.method, "POST");
    assert(url.endsWith("/add"));
    return new Promise(resolve => { complete = resolve; });
  });
  const pending=vm.runInContext('addToWatchlist("abc", "Movie", button)', s.context);
  assert.equal(s.button.disabled,true);
  await vm.runInContext('addToWatchlist("abc", "Movie", button)', s.context);
  assert.equal(calls,1);
  complete({ok:true});
  await pending;
  assert.equal(s.attributes["aria-pressed"],"true");
  s.setFetch(async (url,options) => { assert.equal(options.method,"DELETE"); assert(url.endsWith("/remove")); return {ok:true}; });
  await vm.runInContext('addToWatchlist("abc", "Movie", button)',s.context);
  assert.equal(s.attributes["aria-pressed"],"false");
  assert.equal(s.button.textContent,"Save to watchlist");
});

test("profile renders saved movie details and keeps the card when removal fails", async () => {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.textContent = ""; this.disabled = false; }
    append(...elements) { this.children.push(...elements); }
    replaceChildren(...elements) { this.children = elements; }
    setAttribute() {}
    addEventListener(name, handler) { this.listeners[name] = handler; }
    get firstElementChild() { return this.children[0]; }
  }
  const container = new Element("div");
  const notices = [];
  let removeFails = true;
  let removed = false;
  const context = {
    window: { WEBFLIX_API_BASE: "" }, URL, console,
    localStorage: { getItem() { return "token"; } },
    document: { addEventListener() {}, createElement(tag) { return new Element(tag); }, getElementById() { return container; } },
    alert(message) { notices.push(message); },
    fetch: async (url, options) => {
      if (options?.method === "DELETE") {
        if (removeFails) return { ok: false, status: 500, json: async () => ({ message: "Removal failed" }) };
        removed = true;
        return { ok: true };
      }
      return { ok: true, json: async () => removed ? [] : [{
        movie_id: "abc", title: "<Film & Friends>", year: 2024, genres: ["Drama"],
        poster_url: "javascript:alert(1)", unavailable: false
      }] };
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../js/profile.js", import.meta.url), "utf8"), context);
  await vm.runInContext("loadWatchlist()", context);
  const card = container.children[0].children[0];
  const image = card.children[0];
  const body = card.children[1];
  assert.equal(image.src, "assets/poster-placeholder.svg");
  assert.equal(body.children[0].textContent, "<Film & Friends>");
  assert.equal(body.children[1].textContent, "2024 / Drama");
  assert.equal(body.children[2].href, "movie.html?id=abc");
  const button = body.children[3];
  await button.listeners.click();
  assert.equal(container.children[0].children[0], card);
  assert.equal(button.disabled, false);
  assert.equal(notices[0], "Removal failed");
  removeFails = false;
  await button.listeners.click();
  assert(container.firstElementChild.children[0].textContent.includes("Your watchlist is empty"));
});
