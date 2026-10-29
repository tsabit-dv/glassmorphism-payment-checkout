// UI-only checkout flow: cart -> shipping -> payment. No backend; all state lives here.
(() => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const money = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

  /* ---------- Order state ---------- */
  const ICONS = {
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
    watch: '<circle cx="12" cy="12" r="6"/><path d="M12 9.5V12l1.5 1.5M9 6.5 9.5 2h5l.5 4.5M9 17.5l.5 4.5h5l.5-4.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>',
  };
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';

  const SAMPLE_ITEMS = [
    { id: "aurum", name: "Aurum Wireless Headphones", variant: "Champagne Gold · ANC", price: 549, qty: 1, icon: "headphones", tone: "gold" },
    { id: "obsidian", name: "Obsidian Chrono Watch", variant: "Matte Black · 42mm", price: 399, qty: 1, icon: "watch", tone: "onyx" },
    { id: "lumen", name: "Lumen Leather Card Holder", variant: "Cognac · RFID Shield", price: 89, qty: 2, icon: "wallet", tone: "cognac" },
  ];
  const TAX_RATE = 0.08;
  const PROMOS = { GLASS10: 0.1 };

  const state = {
    items: SAMPLE_ITEMS.map((i) => ({ ...i })),
    promo: null,
    shipping: 0,
    shippingLabel: "Standard",
  };

  const totals = () => {
    const subtotal = state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const discount = state.promo ? subtotal * PROMOS[state.promo] : 0;
    const tax = (subtotal - discount) * TAX_RATE;
    return { subtotal, discount, tax, total: subtotal - discount + state.shipping + tax };
  };

  const thumb = (item) =>
    `<span class="thumb thumb-${item.tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[item.icon]}</svg></span>`;

  function renderCart() {
    $("cartList").innerHTML = state.items
      .map(
        (item) => `
        <li class="cart-item" data-id="${item.id}">
          ${thumb(item)}
          <div class="item-info"><strong>${item.name}</strong><span>${item.variant} · ${money(item.price)}</span></div>
          <div class="qty">
            <button type="button" data-act="dec" aria-label="Decrease quantity" ${item.qty <= 1 ? "disabled" : ""}>−</button>
            <span>${item.qty}</span>
            <button type="button" data-act="inc" aria-label="Increase quantity" ${item.qty >= 9 ? "disabled" : ""}>+</button>
          </div>
          <span class="item-price">${money(item.price * item.qty)}</span>
          <button class="icon-btn remove" type="button" data-act="remove" aria-label="Remove ${item.name}">${TRASH}</button>
        </li>`
      )
      .join("");

    const count = state.items.reduce((sum, i) => sum + i.qty, 0);
    $("cartCount").textContent = `${count} item${count === 1 ? "" : "s"}`;
    $("cartEmpty").hidden = state.items.length > 0;
    $("toShipping").disabled = state.items.length === 0;

    $("miniItems").innerHTML = state.items
      .map((item) => `<li>${thumb(item)}<span class="mini-name">${item.name}</span><span class="mini-qty">×${item.qty}</span><span>${money(item.price * item.qty)}</span></li>`)
      .join("");

    renderSummary();
  }

  function renderSummary() {
    const t = totals();
    const rows = [["Subtotal", money(t.subtotal)]];
    if (t.discount) rows.push([`Discount (${state.promo})`, `−${money(t.discount)}`, "discount"]);
    rows.push([`Shipping · ${state.shippingLabel}`, state.shipping ? money(state.shipping) : "Free"]);
    rows.push([`Tax (${TAX_RATE * 100}%)`, money(t.tax)]);
    const html =
      rows.map(([k, v, cls = ""]) => `<dt class="${cls}">${k}</dt><dd class="${cls}">${v}</dd>`).join("") +
      `<div class="divider" role="presentation"></div><dt class="grand">Total</dt><dd class="grand">${money(t.total)}</dd>`;
    document.querySelectorAll("[data-summary]").forEach((el) => (el.innerHTML = html));

    $("payTotal").textContent = money(t.total);
    $("payLabel").textContent = `PAY ${money(t.total)} NOW`;
    $("paidAmount").textContent = money(t.total);
  }

  /* ---------- Cart interactions ---------- */
  $("cartList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const row = btn.closest(".cart-item");
    const item = state.items.find((i) => i.id === row.dataset.id);

    if (btn.dataset.act === "inc") item.qty = Math.min(item.qty + 1, 9);
    if (btn.dataset.act === "dec") item.qty = Math.max(item.qty - 1, 1);
    if (btn.dataset.act === "remove") {
      const h = row.offsetHeight;
      await row.animate(
        [
          { opacity: 1, transform: "none", height: `${h}px` },
          { opacity: 0, transform: "translateX(40px)", height: `${h}px`, offset: 0.6 },
          { opacity: 0, transform: "translateX(40px)", height: "0px", paddingTop: "0px", paddingBottom: "0px", marginTop: "-12px", borderWidth: "0px" },
        ],
        { duration: 420, easing: "ease-in-out", fill: "forwards" }
      ).finished;
      state.items = state.items.filter((i) => i !== item);
    }
    renderCart();
    if (btn.dataset.act !== "remove") {
      $("cartList").querySelector(`[data-id="${item.id}"] .item-price`)
        ?.animate([{ transform: "scale(1.12)", color: "#f7c21c" }, { transform: "none" }], { duration: 400, easing: EASE_OUT });
    }
  });

  $("restoreCart").addEventListener("click", () => {
    state.items = SAMPLE_ITEMS.map((i) => ({ ...i }));
    renderCart();
  });

  $("promoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $("promoInput").value.trim().toUpperCase();
    const msg = $("promoMsg");
    if (!code) {
      state.promo = null;
      msg.textContent = "";
    } else if (PROMOS[code]) {
      state.promo = code;
      msg.className = "promo-msg ok";
      msg.textContent = `${code} applied — ${PROMOS[code] * 100}% off your subtotal.`;
    } else {
      state.promo = null;
      msg.className = "promo-msg err";
      msg.textContent = "That code isn't valid.";
    }
    renderSummary();
  });

  $("toShipping").addEventListener("click", () => goTo("shipping"));

  /* ---------- Shipping ---------- */
  const shipForm = $("shipForm");
  shipForm.addEventListener("change", (e) => {
    if (e.target.name !== "ship") return;
    state.shipping = Number(e.target.value);
    state.shippingLabel = e.target.dataset.label;
    renderSummary();
  });

  shipForm.addEventListener("submit", (e) => {
    e.preventDefault();
    let firstInvalid = null;
    shipForm.querySelectorAll("input[required]").forEach((input) => {
      const valid = input.value.trim().length > 0;
      input.parentElement.classList.toggle("invalid", !valid);
      if (!valid && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) return firstInvalid.focus();
    goTo("payment");
  });

  /* ---------- Step navigation ---------- */
  const ORDER = ["cart", "shipping", "payment"];
  const viewsEl = $("views");
  const viewOf = (name) => viewsEl.querySelector(`[data-view="${name}"]`);
  let current = "cart";
  let navigating = false;
  let busy = false;
  let paid = false;

  function renderSteps() {
    const idx = ORDER.indexOf(current);
    document.querySelectorAll("#steps .step").forEach((li, i) => {
      const done = i < idx || (paid && i === idx);
      li.classList.toggle("done", done);
      li.classList.toggle("active", i === idx && !paid);
      li.classList.toggle("paid", paid && i === idx);
      li.querySelector(".step-dot").innerHTML = done ? CHECK : String(i + 1);
      li.querySelector("button").disabled = !(i < idx) || paid || busy;
      if (i === idx) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
  }

  async function goTo(name) {
    if (name === current || navigating) return;
    navigating = true;
    const from = viewOf(current);
    const to = viewOf(name);
    const dir = ORDER.indexOf(name) > ORDER.indexOf(current) ? 1 : -1;

    const h0 = viewsEl.offsetHeight;
    viewsEl.classList.add("resizing");
    viewsEl.style.height = `${h0}px`;

    await from.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-40 * dir}px)` }],
      { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)" }
    ).finished;

    from.hidden = true;
    to.hidden = false;
    current = name;
    renderSteps();

    viewsEl.style.height = "";
    const h1 = viewsEl.offsetHeight;
    const grow = viewsEl.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 450, easing: EASE_OUT });
    const enters = [...to.children].map((child, i) =>
      child.animate(
        [{ opacity: 0, transform: `translateX(${40 * dir}px)` }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: i * 90, easing: EASE_OUT, fill: "backwards" }
      )
    );

    const panelTop = viewsEl.closest(".panel-frame").getBoundingClientRect().top;
    if (panelTop < 0) window.scrollBy({ top: panelTop - 16, behavior: "smooth" });

    await Promise.all([grow.finished, ...enters.map((a) => a.finished)]);
    viewsEl.classList.remove("resizing");
    navigating = false;
  }

  document.querySelectorAll("#steps .step button").forEach((btn) =>
    btn.addEventListener("click", () => goTo(btn.closest(".step").dataset.step))
  );
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-go]");
    if (target && !busy) goTo(target.dataset.go);
  });

  /* ---------- Payment: card preview ---------- */
  const card = $("card");
  const inName = $("inName");
  const inNumber = $("inNumber");
  const inExpiry = $("inExpiry");
  const inCvv = $("inCvv");

  const brandOf = (digits) => {
    if (/^4/.test(digits)) return "VISA";
    if (/^(5[1-5]|2[2-7])/.test(digits)) return "MASTERCARD";
    if (/^3[47]/.test(digits)) return "AMEX";
    if (/^6/.test(digits)) return "DISCOVER";
    return digits ? "CARD" : "VISA";
  };

  const setFlipped = (flipped) => {
    card.classList.toggle("flipped", flipped);
    $("flipLabel").textContent = flipped ? "Flip to Front" : "Flip to CVV";
  };

  inName.addEventListener("input", () => {
    $("cardName").textContent = inName.value.trim().toUpperCase() || "YOUR NAME";
  });

  inNumber.addEventListener("input", () => {
    const digits = inNumber.value.replace(/\D/g, "").slice(0, 16);
    inNumber.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    const padded = digits.padEnd(16, "•");
    $("cardNumber").textContent = padded.match(/.{4}/g).join(" ");
    const brand = brandOf(digits);
    $("cardBrand").textContent = brand;
    $("cardBrandBack").textContent = brand;
    $("inBrand").textContent = brand;
  });

  inExpiry.addEventListener("input", (e) => {
    let digits = inExpiry.value.replace(/\D/g, "").slice(0, 4);
    if (digits.length === 1 && Number(digits) > 1) digits = "0" + digits;
    const deleting = e.inputType && e.inputType.startsWith("delete");
    inExpiry.value = digits.length >= 3 || (digits.length === 2 && !deleting)
      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;
    $("cardExpiry").textContent = inExpiry.value || "MM/YY";
  });

  inCvv.addEventListener("input", () => {
    inCvv.value = inCvv.value.replace(/\D/g, "").slice(0, 4);
    const shown = inCvv.type === "text" ? inCvv.value : "•".repeat(inCvv.value.length);
    $("cardCvv").textContent = shown || "•••";
  });
  inCvv.addEventListener("focus", () => setFlipped(true));
  inCvv.addEventListener("blur", () => setFlipped(false));

  $("eyeBtn").addEventListener("click", () => {
    const show = inCvv.type === "password";
    inCvv.type = show ? "text" : "password";
    $("eyeBtn").classList.toggle("on", show);
    $("eyeBtn").setAttribute("aria-label", show ? "Hide CVV" : "Show CVV");
    inCvv.dispatchEvent(new Event("input"));
  });

  $("flipBtn").addEventListener("click", () => setFlipped(!card.classList.contains("flipped")));

  /* ---------- Payment: processing + success ---------- */
  const paymentView = $("paymentView");
  const scene = document.querySelector(".card-scene");
  const status = $("status");

  $("payForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const checks = [
      [inName, inName.value.trim().length > 1],
      [inNumber, inNumber.value.replace(/\D/g, "").length >= 15],
      [inExpiry, /^(0[1-9]|1[0-2])\/\d{2}$/.test(inExpiry.value)],
      [inCvv, inCvv.value.length >= 3],
    ];
    let ok = true;
    for (const [input, valid] of checks) {
      input.parentElement.classList.toggle("invalid", !valid);
      if (!valid && ok) { input.focus(); ok = false; }
    }
    if (ok) startPayment();
  });

  // FLIP: animate the card from its old spot to wherever the new layout puts it.
  const moveCard = (changeLayout) => {
    const first = scene.getBoundingClientRect();
    changeLayout();
    const last = scene.getBoundingClientRect();
    scene.animate(
      [
        { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width})` },
        { transform: "none" },
      ],
      { duration: 750, easing: EASE_OUT }
    );
  };

  async function startPayment() {
    if (busy) return;
    busy = true;
    renderSteps();
    setFlipped(false);
    scene.classList.remove("tilting");
    scene.style.transform = "";
    document.activeElement?.blur();
    paymentView.style.minHeight = `${paymentView.offsetHeight}px`;

    paymentView.classList.add("leaving");
    await wait(350);

    moveCard(() => paymentView.classList.add("processing"));
    card.classList.add("is-processing");
    await nextFrame();
    status.dataset.state = "processing";

    await wait(2800);
    card.classList.replace("is-processing", "is-success");
    status.dataset.state = "success";
    paid = true;
    busy = false;
    renderSteps();
  }

  async function startNewOrder() {
    if (busy || navigating) return;
    busy = true;
    state.items = SAMPLE_ITEMS.map((i) => ({ ...i }));
    state.promo = null;
    state.shipping = 0;
    state.shippingLabel = "Standard";
    $("promoInput").value = "";
    $("promoMsg").textContent = "";
    shipForm.querySelector('input[name="ship"][value="0"]').checked = true;
    renderCart();

    paid = false;
    await goTo("cart");

    // Payment view is hidden now: put it back to its form state for next time.
    status.dataset.state = "";
    card.classList.remove("is-success", "is-processing");
    paymentView.classList.remove("processing", "leaving");
    paymentView.style.minHeight = "";
    inCvv.value = "";
    inCvv.dispatchEvent(new Event("input"));
    busy = false;
    renderSteps();
  }

  $("againBtn").addEventListener("click", startNewOrder);

  // Subtle 3D tilt + moving glare on the card (desktop pointers only).
  const cardCol = document.querySelector(".card-col");
  if (matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) {
    cardCol.addEventListener("pointermove", (e) => {
      if (busy || paymentView.classList.contains("processing")) return;
      const r = scene.getBoundingClientRect();
      const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      scene.classList.add("tilting");
      scene.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg)`;
      scene.style.setProperty("--mx", `${x * 100}%`);
      scene.style.setProperty("--my", `${y * 100}%`);
    });
    cardCol.addEventListener("pointerleave", () => {
      scene.classList.remove("tilting");
      scene.style.transform = "";
      scene.style.removeProperty("--mx");
      scene.style.removeProperty("--my");
    });
  }

  document.querySelectorAll(".input input").forEach((input) =>
    input.addEventListener("input", () => input.parentElement.classList.remove("invalid"))
  );

  renderCart();
  renderSteps();
})();
