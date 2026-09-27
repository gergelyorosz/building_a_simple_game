(() => {
  "use strict";

  const STORAGE_KEY = "cocktailflow.bar";
  const PANTRY_KEY = "cocktailflow.pantry";
  const ALL_INGREDIENTS = Object.values(INGREDIENT_GROUPS).flat();
  const GLASS_EMOJI = { "Shot": "🥃", "Rocks": "🥃", "Flute": "🥂", "Wine glass": "🍷", "Pint": "🍺",
    "Martini": "🍸", "Coupe": "🍸", "Margarita": "🍸", "Hurricane": "🍹", "Tiki mug": "🍹",
    "Mug": "☕", "Irish coffee glass": "☕" };

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // ---------- State ----------
  const state = {
    bar: new Set(load(STORAGE_KEY, [])),
    usePantry: load(PANTRY_KEY, true),
    browse: { category: "base", value: null, query: "" }
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.bar]));
      localStorage.setItem(PANTRY_KEY, JSON.stringify(state.usePantry));
    } catch { /* storage unavailable — selection just won't persist */ }
  }

  // Everything the user effectively has, including pantry basics if enabled.
  function haveSet() {
    const have = new Set(state.bar);
    if (state.usePantry) PANTRY_BASICS.forEach((i) => have.add(i));
    return have;
  }
  const ingredientsOf = (c) => c.ings.map(([name]) => name);
  const missingFor = (c, have) => ingredientsOf(c).filter((i) => !have.has(i));

  // ---------- Rendering helpers ----------
  function cardHTML(c, extra = "") {
    const emoji = GLASS_EMOJI[c.glass] || "🍹";
    return `
      <button class="card" data-cocktail="${esc(c.name)}" style="--drink: var(--c-${c.color})">
        <div class="card-art" aria-hidden="true">${emoji}</div>
        <div class="card-body">
          <h3>${esc(c.name)}</h3>
          <div class="card-meta">${esc(CATEGORIES.base.values[c.base])} · ${esc(CATEGORIES.strength.values[c.strength])}</div>
          ${extra}
        </div>
      </button>`;
  }

  function renderGrid(el, cocktails, extraFn, emptyMsg) {
    el.innerHTML = cocktails.length
      ? cocktails.map((c) => cardHTML(c, extraFn ? extraFn(c) : "")).join("")
      : `<div class="empty">${emptyMsg}</div>`;
  }

  // ---------- Browse view ----------
  function renderBrowse() {
    const { category, value, query } = state.browse;

    $("#category-tabs").innerHTML = Object.entries(CATEGORIES).map(([key, cat]) =>
      `<button role="tab" data-cat="${key}" class="${key === category ? "active" : ""}" aria-selected="${key === category}">${esc(cat.label)}</button>`
    ).join("");

    const matchesCategory = (c, cat, val) =>
      cat === "collection" ? c.collections.includes(val) : c[cat] === val;

    const values = Object.entries(CATEGORIES[category].values);
    $("#category-values").innerHTML =
      `<button class="chip ${value === null ? "active" : ""}" data-val="">All<span class="count">${COCKTAILS.length}</span></button>` +
      values.map(([key, label]) => {
        const n = COCKTAILS.filter((c) => matchesCategory(c, category, key)).length;
        return `<button class="chip ${value === key ? "active" : ""}" data-val="${key}">${esc(label)}<span class="count">${n}</span></button>`;
      }).join("");

    const q = query.trim().toLowerCase();
    const list = COCKTAILS.filter((c) =>
      (value === null || matchesCategory(c, category, value)) &&
      (!q || c.name.toLowerCase().includes(q) || ingredientsOf(c).some((i) => i.toLowerCase().includes(q)))
    ).sort((a, b) => a.name.localeCompare(b.name));

    const label = value === null ? "All cocktails" : CATEGORIES[category].values[value];
    $("#browse-count").textContent = `${label} — ${list.length} recipe${list.length === 1 ? "" : "s"}`;
    renderGrid($("#browse-grid"), list, (c) =>
      `<div>${[CATEGORIES.type.values[c.type], CATEGORIES.color.values[c.color]].map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`,
      "No cocktails match your search.");
  }

  $("#category-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.browse.category = btn.dataset.cat;
    state.browse.value = null;
    renderBrowse();
  });
  $("#category-values").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    state.browse.value = btn.dataset.val || null;
    renderBrowse();
  });
  $("#search").addEventListener("input", (e) => {
    state.browse.query = e.target.value;
    renderBrowse();
  });

  // ---------- Ingredient picker (shared by My Bar and Shopping) ----------
  // Only list ingredients that at least one recipe uses.
  const USED = new Set(COCKTAILS.flatMap(ingredientsOf));

  function renderIngredientPanel(el) {
    const filter = (el.querySelector(".ing-filter")?.value || "").toLowerCase();
    const groups = Object.entries(INGREDIENT_GROUPS).map(([group, items]) => {
      const shown = items.filter((i) => USED.has(i) && i.toLowerCase().includes(filter));
      if (!shown.length) return "";
      return `<div class="ing-group"><h3>${esc(group)}</h3><div class="ing-list">${
        shown.map((i) => `<button class="chip ${state.bar.has(i) ? "active" : ""}" data-ing="${esc(i)}" aria-pressed="${state.bar.has(i)}">${esc(i)}</button>`).join("")
      }</div></div>`;
    }).join("");

    if (!el.dataset.ready) {
      el.innerHTML = `
        <div class="panel-top">
          <h2>My ingredients <span class="pill" data-role="count"></span></h2>
          <button class="link-btn" data-action="clear">Clear</button>
        </div>
        <input class="ing-filter" type="search" placeholder="Filter ingredients…" aria-label="Filter ingredients">
        <label class="pantry-toggle"><input type="checkbox" data-action="pantry"> Assume pantry basics (${PANTRY_BASICS.join(", ").toLowerCase()})</label>
        <div data-role="groups"></div>`;
      el.dataset.ready = "1";
      el.querySelector(".ing-filter").addEventListener("input", () => renderIngredientPanel(el));
      el.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-ing]");
        if (chip) {
          const ing = chip.dataset.ing;
          state.bar.has(ing) ? state.bar.delete(ing) : state.bar.add(ing);
          onBarChange();
        } else if (e.target.closest('[data-action="clear"]')) {
          state.bar.clear();
          onBarChange();
        }
      });
      el.querySelector('[data-action="pantry"]').addEventListener("change", (e) => {
        state.usePantry = e.target.checked;
        onBarChange();
      });
    }
    el.querySelector('[data-role="groups"]').innerHTML = groups || `<p class="card-meta">No ingredients match.</p>`;
    el.querySelector('[data-role="count"]').textContent = state.bar.size;
    el.querySelector('[data-action="pantry"]').checked = state.usePantry;
  }

  function onBarChange() {
    save();
    renderCurrentView();
  }

  // ---------- My Bar view ----------
  function renderBar() {
    renderIngredientPanel($("#ingredient-panel-bar"));
    const have = haveSet();
    const byName = (a, b) => a.name.localeCompare(b.name);
    const canMake = COCKTAILS.filter((c) => missingFor(c, have).length === 0).sort(byName);
    const almost = COCKTAILS.filter((c) => missingFor(c, have).length === 1).sort(byName);

    $("#can-make-count").textContent = canMake.length;
    $("#almost-count").textContent = almost.length;
    renderGrid($("#can-make-grid"), canMake, null,
      state.bar.size ? "Nothing complete yet — check the “missing one” list below." : "Select ingredients on the left to see what you can make.");
    renderGrid($("#almost-grid"), almost,
      (c) => `<div class="card-missing">Need: ${esc(missingFor(c, have)[0])}</div>`,
      "No near-misses yet.");
  }

  // ---------- Shopping suggestions ----------
  // Cocktails that become makeable if `basket` is bought.
  function unlockedBy(basket, have) {
    const extended = new Set([...have, ...basket]);
    return COCKTAILS.filter((c) => missingFor(c, have).length > 0 && missingFor(c, extended).length === 0);
  }

  // Greedily build a basket of up to `size` items from `pool` cocktails.
  // Each step picks the ingredient that unlocks the most cocktails; ties (and zero-unlock steps)
  // are broken by how many pool cocktails it brings to within one missing ingredient.
  function greedyBasket(pool, have, size) {
    const basket = [];
    for (let step = 0; step < size; step++) {
      const extended = new Set([...have, ...basket]);
      const candidates = new Set(pool.flatMap((c) => missingFor(c, extended)));
      let best = null;
      for (const ing of candidates) {
        const next = new Set([...extended, ing]);
        const unlocked = pool.filter((c) => missingFor(c, extended).length > 0 && missingFor(c, next).length === 0).length;
        const closer = pool.filter((c) => missingFor(c, next).length === 1 && missingFor(c, extended).length > 1).length;
        const score = unlocked * 100 + closer;
        if (!best || score > best.score) best = { ing, score };
      }
      if (!best || best.score === 0) break;
      basket.push(best.ing);
    }
    return basket;
  }

  function groupOf(ing) {
    return Object.keys(INGREDIENT_GROUPS).find((g) => INGREDIENT_GROUPS[g].includes(ing)) || "";
  }

  function cocktailLinks(list) {
    if (!list.length) return "nothing yet";
    return list.map((c) => `<button class="link-btn" data-cocktail="${esc(c.name)}">${esc(c.name)}</button>`).join(", ");
  }

  function basketCard(title, sub, basket, have) {
    const unlocked = unlockedBy(basket, have);
    return `
      <article class="shop-card">
        <h2>${title}</h2>
        <p class="sub">${sub}</p>
        ${basket.length ? `
          <div class="buy-list">${basket.map((i) =>
            `<div class="buy-item"><strong>${esc(i)}</strong><span>${esc(groupOf(i))}</span></div>`).join("")}
          </div>
          <p class="unlocks"><strong>Unlocks ${unlocked.length} cocktail${unlocked.length === 1 ? "" : "s"}:</strong> ${cocktailLinks(unlocked)}</p>
          <button class="add-btn" data-add="${esc(JSON.stringify(basket))}">I bought these — add to my bar</button>
        ` : `<p class="card-meta">Nothing to suggest here — you can already make everything in this set!</p>`}
      </article>`;
  }

  function renderShopping() {
    renderIngredientPanel($("#ingredient-panel-shop"));
    const have = haveSet();
    const canMake = COCKTAILS.filter((c) => missingFor(c, have).length === 0).length;

    // 1. Quick wins: single ingredients ranked by how many cocktails each unlocks on its own.
    const singles = [...new Set(COCKTAILS.flatMap((c) => missingFor(c, have)))]
      .map((ing) => ({ ing, unlocked: unlockedBy([ing], have) }))
      .filter((s) => s.unlocked.length > 0)
      .sort((a, b) => b.unlocked.length - a.unlocked.length || a.ing.localeCompare(b.ing))
      .slice(0, 5);

    const quickWins = `
      <article class="shop-card">
        <h2>⚡ Quick Wins</h2>
        <p class="sub">Buy just one bottle or item. These single purchases unlock the most new cocktails.</p>
        ${singles.length ? singles.map((s) => `
          <div class="single-row">
            <div><strong>${esc(s.ing)}</strong> <span class="tag">${esc(groupOf(s.ing))}</span>
              <div class="unlocks">+${s.unlocked.length}: ${cocktailLinks(s.unlocked)}</div>
            </div>
            <button class="add-btn" data-add="${esc(JSON.stringify([s.ing]))}">Add</button>
          </div>`).join("")
        : `<p class="card-meta">No single item unlocks a new cocktail yet. Try the bundles below, or add a few basics first.</p>`}
      </article>`;

    // 2. Best value bundle: three items that together unlock the most cocktails overall.
    const bundle = greedyBasket(COCKTAILS, have, 3);

    // 3. New direction: pick a spirit family you don't own a bottle from yet,
    //    and find the three items that open it up the most.
    let direction = null;
    for (const [base, spirits] of Object.entries(BASE_SPIRITS)) {
      if (spirits.some((s) => state.bar.has(s))) continue; // already exploring this family
      const label = CATEGORIES.base.values[base];
      const pool = COCKTAILS.filter((c) => c.base === base);
      const basket = greedyBasket(pool, have, 3);
      const gained = unlockedBy(basket, have).filter((c) => c.base === base).length;
      if (basket.length && (!direction || gained > direction.gained)) direction = { base, label, basket, gained };
    }

    $("#shopping-results").innerHTML = `
      <p class="shop-status">With your current bar you can make <strong>${canMake}</strong> of ${COCKTAILS.length} cocktails.
        ${state.bar.size ? "" : "Select what you already have on the left for personalised suggestions."}</p>
      <div class="shop-cards">
        ${quickWins}
        ${basketCard("🛒 Best Value Bundle", "Three items that, bought together, unlock the most cocktails.", bundle, have)}
        ${direction
          ? basketCard(`🧭 New Direction: ${esc(direction.label)}`,
              `Branch out into ${esc(direction.label.toLowerCase())} cocktails, a family you haven't explored yet.`, direction.basket, have)
          : `<article class="shop-card"><h2>🧭 New Direction</h2><p class="sub">You've already covered every family of cocktails. Impressive bar!</p></article>`}
      </div>`;
  }

  $("#shopping-results").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (!add) return;
    JSON.parse(add.dataset.add).forEach((i) => state.bar.add(i));
    onBarChange();
  });

  // ---------- Recipe dialog ----------
  const dialog = $("#recipe-dialog");

  function openRecipe(name) {
    const c = COCKTAILS.find((x) => x.name === name);
    if (!c) return;
    const have = haveSet();
    const tags = [CATEGORIES.base.values[c.base], CATEGORIES.type.values[c.type],
      CATEGORIES.strength.values[c.strength], CATEGORIES.color.values[c.color],
      ...c.collections.map((k) => CATEGORIES.collection.values[k])];
    $("#recipe-content").innerHTML = `
      <div class="recipe-head" style="--drink: var(--c-${c.color})">
        <button class="close-btn" aria-label="Close" data-close>✕</button>
        <h2>${esc(c.name)}</h2>
        <div>${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      </div>
      <div class="recipe-body">
        <h3>Ingredients</h3>
        <ul class="recipe-ings">${c.ings.map(([i, amt]) =>
          `<li class="${have.has(i) ? "have" : "missing"}"><span>${esc(i)}</span><span>${esc(amt)}</span></li>`).join("")}
        </ul>
        <h3>Method</h3><p>${esc(c.method)}</p>
        <h3>Glass</h3><p>${esc(c.glass)}</p>
        ${c.garnish ? `<h3>Garnish</h3><p>${esc(c.garnish)}</p>` : ""}
      </div>`;
    dialog.showModal();
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-cocktail]");
    if (trigger) openRecipe(trigger.dataset.cocktail);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });

  // ---------- Routing ----------
  const VIEWS = { browse: renderBrowse, bar: renderBar, shopping: renderShopping };

  function currentView() {
    const v = location.hash.slice(1);
    return VIEWS[v] ? v : "browse";
  }

  function renderCurrentView() {
    const view = currentView();
    document.querySelectorAll(".view").forEach((s) => { s.hidden = s.id !== `view-${view}`; });
    document.querySelectorAll(".main-nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
    VIEWS[view]();
  }

  window.addEventListener("hashchange", () => { renderCurrentView(); window.scrollTo(0, 0); });

  // Sanity check: every recipe ingredient must be pickable.
  COCKTAILS.forEach((c) => ingredientsOf(c).forEach((i) => {
    if (!ALL_INGREDIENTS.includes(i)) console.warn(`Unknown ingredient "${i}" in ${c.name}`);
  }));

  renderCurrentView();
})();
