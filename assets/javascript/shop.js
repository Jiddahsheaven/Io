/* ============================================================
   JIDDERHS HEAVEN — SHOP PAGE JAVASCRIPT
   This page is a shop/category page, not the homepage.
   Existing cart storage key is preserved for checkout.js.
   ============================================================ */

import { supabase } from "./supabase.js";

/* 1. CONFIGURATION ------------------------------------------------ */
const CONFIG = {
  productsTable: "products",
  cartKey: "jiddamarh-cart", // Keep in sync with checkout.js.
  favoritesKey: "jidderhs-heaven-favorites",
  locale: "en-NG",
  currency: "NGN"
};

/* Keep the four store categories distinct. These names are the
   display/filter values; the database may store lowercase values. */
const CATEGORY_LOOKUP = {
  apparel: "Apparel",
  fashion: "Apparel",
  clothes: "Apparel",
  clothing: "Apparel",
  outfit: "Apparel",
  outfits: "Apparel",
  abaya: "Apparel",

  beauty: "Beauty",
  makeup: "Beauty",
  "make up": "Beauty",
  cosmetics: "Beauty",
  skincare: "Beauty",
  "skin care": "Beauty",

  kitchen: "Kitchen",
  home: "Kitchen",
  "home & living": "Kitchen",
  "home living": "Kitchen",
  home_living: "Kitchen",
  cookware: "Kitchen",
  utensils: "Kitchen",
  kitchenware: "Kitchen",
  glassware: "Kitchen",
  cutlery: "Kitchen",

  toiletries: "Toiletries",
  "personal care": "Toiletries",
  hygiene: "Toiletries",
  sanitary: "Toiletries",
  "bath & body": "Toiletries"
};

const moneyFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency",
  currency: CONFIG.currency,
  maximumFractionDigits: 2
});

/* 2. DOM + FORMATTING HELPERS ------------------------------------ */
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalizeText(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCategory(value = "") {
  const key = normalizeText(value);
  return CATEGORY_LOOKUP[key] || (key ? key.replace(/\b\w/g, letter => letter.toUpperCase()) : "Other");
}

function formatMoney(value) {
  const amount = Number(value);
  return moneyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  if (!toast) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  toast.textContent = message;
  toast.classList.remove("show", "success", "error", "warning");
  toast.classList.add("show", type);
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Could not read localStorage item ${key}:`, error);
    return fallback;
  }
}

/* 3. APPLICATION STATE ------------------------------------------- */
let products = [];
let visibleProducts = [];
let cart = [];
let favorites = new Set();
let activeCategory = "All";
let searchQuery = "";
let favoritesOnly = false;
let selectedProduct = null;
let lastFocusedElement = null;
let productsFailed = false;

/* 4. LOCAL STORAGE ------------------------------------------------ */
function loadCart() {
  const stored = readJSON(CONFIG.cartKey, []);
  if (!Array.isArray(stored)) {
    cart = [];
    return;
  }

  cart = stored.map(item => {
    const id = item?.id ?? item?.product_id;
    const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    return {
      id: String(id ?? ""),
      name: String(item?.name || item?.title || "Product"),
      price: Number(item?.price) || 0,
      image: String(item?.image || item?.image_url || ""),
      quantity,
      stock: item?.stock !== null && item?.stock !== undefined && item?.stock !== "" && Number.isFinite(Number(item.stock))
        ? Number(item.stock)
        : null,
      category: String(item?.category || "Other")
    };
  }).filter(item => item.id);
}

function saveCart() {
  try {
    localStorage.setItem(CONFIG.cartKey, JSON.stringify(cart));
  } catch (error) {
    console.error("Could not save shopping bag:", error);
    showToast("Your bag could not be saved on this device.", "error");
  }
}

function loadFavorites() {
  const stored = readJSON(CONFIG.favoritesKey, []);
  favorites = new Set(Array.isArray(stored) ? stored.map(String) : []);
}

function saveFavorites() {
  try {
    localStorage.setItem(CONFIG.favoritesKey, JSON.stringify([...favorites]));
  } catch (error) {
    console.warn("Could not save favorites:", error);
  }
}

/* 5. PRODUCT DATA + SUPABASE -------------------------------------- */
function getStock(product) {
  if (product.stock === null || product.stock === undefined || product.stock === "") {
    return null;
  }
  const value = Number(product.stock);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function getImageURL(product) {
  const candidate = product.image_url || product.image || product.imageUrl || "";
  const value = String(candidate).trim();
  if (!value) return "";
  // Allow normal hosted URLs and relative paths; reject executable schemes.
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(value)) return value;
  return "";
}

function normalizeProduct(row) {
  return {
    id: String(row.id),
    name: String(row.name || row.title || "Untitled product"),
    description: String(row.description || "Discover more about this product and its details."),
    category: normalizeCategory(row.category),
    price: Number(row.price) || 0,
    image: getImageURL(row),
    stock: getStock(row),
    createdAt: row.created_at || ""
  };
}

async function fetchProducts() {
  const loading = $("#loadingState");
  const grid = $("#productGrid");
  const empty = $("#emptyState");
  if (loading) loading.hidden = false;
  if (empty) empty.hidden = true;
  if (grid) grid.innerHTML = "";

  try {
    const { data, error } = await supabase
      .from(CONFIG.productsTable)
      .select("id,name,description,category,price,image_url,stock,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = (data || []).map(normalizeProduct);
    productsFailed = false;

    // Refresh details for items already in the locally saved bag.
    cart = cart.map(item => {
      const latest = products.find(product => product.id === item.id);
      if (!latest) return item;
      return {
        ...item,
        name: latest.name,
        price: latest.price,
        image: latest.image,
        stock: latest.stock,
        category: latest.category
      };
    });
    saveCart();

    renderProducts();
    renderCart();
    if (!products.length) showEmptyState("There are no active products available at the moment.");
  } catch (error) {
    console.error("Unable to load products from Supabase:", error);
    products = [];
    visibleProducts = [];
    productsFailed = true;
    renderProducts();
    showEmptyState("We couldn't load the collection. Check your Supabase products access and internet connection, then refresh this page.");
    showToast("Products could not be loaded. Please try again.", "error");
  } finally {
    if (loading) loading.hidden = true;
    updateResultsCount();
  }
}

/* 6. PRODUCT CARD RENDERING --------------------------------------- */
function stockLabel(product) {
  if (product.stock === null) return "Stock not confirmed";
  if (product.stock <= 0) return "Out of stock";
  if (product.stock <= 5) return `Only ${product.stock} left`;
  return "In stock";
}

function productImageMarkup(product) {
  if (!product.image) {
    return '<div class="product-image-placeholder" aria-label="Product image unavailable">JH</div>';
  }
  return `<img class="product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" data-product-image>`;
}

function renderProductCard(product) {
  const isFavorite = favorites.has(product.id);
  const soldOut = product.stock !== null && product.stock <= 0;
  const lowStock = product.stock !== null && product.stock > 0 && product.stock <= 5;
  const stockClass = soldOut ? "is-out" : lowStock ? "is-low" : "";

  return `
    <article class="product-card" data-product-id="${escapeHTML(product.id)}">
      <div class="product-card-image-wrap">
        ${productImageMarkup(product)}
        <span class="product-category-label">${escapeHTML(product.category)}</span>
        <button class="product-favorite-button ${isFavorite ? "is-favorite" : ""}" type="button" data-action="favorite" data-id="${escapeHTML(product.id)}" aria-label="${isFavorite ? "Remove from saved items" : "Save item"}" aria-pressed="${isFavorite}">${isFavorite ? "♥" : "♡"}</button>
        ${soldOut ? '<span class="product-stock-badge sold-out">Sold out</span>' : ""}
      </div>
      <div class="product-card-content">
        <p class="product-stock-text ${stockClass}">${escapeHTML(stockLabel(product))}</p>
        <h3 class="product-title">${escapeHTML(product.name)}</h3>
        <p class="product-description">${escapeHTML(product.description)}</p>
        <div class="product-card-bottom">
          <strong class="product-price">${formatMoney(product.price)}</strong>
          <button class="product-view-button" type="button" data-action="view" data-id="${escapeHTML(product.id)}">View details</button>
        </div>
        <button class="product-add-button" type="button" data-action="add" data-id="${escapeHTML(product.id)}" ${soldOut || product.stock === null ? "disabled" : ""}>${soldOut ? "Out of stock" : product.stock === null ? "Stock unavailable" : "Add to bag"}</button>
      </div>
    </article>`;
}

function renderProducts() {
  const grid = $("#productGrid");
  if (!grid) return;

  visibleProducts = getFilteredProducts();
  grid.innerHTML = visibleProducts.map(renderProductCard).join("");

  const empty = $("#emptyState");
  if (empty && !productsFailed) empty.hidden = visibleProducts.length > 0;

  updateResultsCount();
  updateActiveCategoryButtons();
  updateFavoritesCount();
}

function showEmptyState(message) {
  const empty = $("#emptyState");
  if (!empty) return;
  empty.hidden = false;
  const paragraph = $("p:not(.eyebrow)", empty);
  if (paragraph) paragraph.textContent = message;
}

/* 7. SEARCH, CATEGORY FILTERS + SORTING --------------------------- */
function searchTerms(value) {
  const query = normalizeText(value);
  if (!query) return [];

  const terms = [query];
  const mappedCategory = CATEGORY_LOOKUP[query];
  if (mappedCategory) terms.push(normalizeText(mappedCategory));

  const aliases = {
    fashion: ["apparel", "clothes", "outfit", "abaya"],
    apparel: ["fashion", "clothes", "outfit", "abaya"],
    beauty: ["makeup", "cosmetics", "skincare"],
    makeup: ["beauty", "cosmetics", "skincare"],
    kitchen: ["utensils", "cookware", "glassware", "cutlery"],
    utensils: ["kitchen", "cookware", "glassware", "cutlery"],
    toiletries: ["personal care", "hygiene", "sanitary"]
  };
  terms.push(...(aliases[query] || []));
  return [...new Set(terms)];
}

function matchesSearch(product) {
  if (!searchQuery) return true;
  const haystack = normalizeText(`${product.name} ${product.description} ${product.category}`);
  return searchTerms(searchQuery).some(term => haystack.includes(term));
}

function getFilteredProducts() {
  let result = [...products];

  if (activeCategory !== "All") {
    result = result.filter(product => product.category === activeCategory);
  }
  result = result.filter(matchesSearch);

  if (favoritesOnly) result = result.filter(product => favorites.has(product.id));

  if ($("#inStockOnly")?.checked) {
    result = result.filter(product => product.stock !== null && product.stock > 0);
  }

  const minValue = $("#minimumPrice")?.value;
  const maxValue = $("#maximumPrice")?.value;
  if (minValue !== "" && minValue !== undefined) {
    const min = Number(minValue);
    if (Number.isFinite(min)) result = result.filter(product => product.price >= min);
  }
  if (maxValue !== "" && maxValue !== undefined) {
    const max = Number(maxValue);
    if (Number.isFinite(max)) result = result.filter(product => product.price <= max);
  }

  switch ($("#sortSelect")?.value || "newest") {
    case "price-low": result.sort((a, b) => a.price - b.price); break;
    case "price-high": result.sort((a, b) => b.price - a.price); break;
    case "name-asc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "newest":
    default:
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
  }
  return result;
}

function updateResultsCount() {
  const element = $("#resultsCount");
  if (!element) return;
  const amount = visibleProducts.length;
  element.textContent = `${amount} ${amount === 1 ? "item" : "items"}`;
}

function updateActiveCategoryButtons() {
  $$('[data-filter]').forEach(button => {
    const value = button.dataset.filter || "All";
    const active = value === "All" ? activeCategory === "All" : normalizeCategory(value) === activeCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $$('[data-category]').forEach(card => {
    card.classList.toggle("active", normalizeCategory(card.dataset.category) === activeCategory);
  });
}

function setCategory(value) {
  activeCategory = value === "All" ? "All" : normalizeCategory(value);
  favoritesOnly = false;
  renderProducts();
  $("#catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetFilters() {
  activeCategory = "All";
  favoritesOnly = false;
  searchQuery = "";
  if ($("#searchInput")) $("#searchInput").value = "";
  if ($("#minimumPrice")) $("#minimumPrice").value = "";
  if ($("#maximumPrice")) $("#maximumPrice").value = "";
  if ($("#inStockOnly")) $("#inStockOnly").checked = false;
  if ($("#sortSelect")) $("#sortSelect").value = "newest";
  const suggestions = $("#searchSuggestions");
  if (suggestions) suggestions.hidden = true;
  renderProducts();
}

/* 8. SEARCH PANEL + SUGGESTIONS ---------------------------------- */
function openSearchPanel() {
  const panel = $("#searchPanel");
  if (!panel) return;
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add("is-open"));
  setTimeout(() => $("#searchInput")?.focus(), 80);
}

function closeSearchPanel() {
  const panel = $("#searchPanel");
  if (!panel) return;
  panel.classList.remove("is-open");
  panel.hidden = true;
  const suggestions = $("#searchSuggestions");
  if (suggestions) suggestions.hidden = true;
}

function renderSearchSuggestions(value) {
  const box = $("#searchSuggestions");
  if (!box) return;
  const query = normalizeText(value);
  if (!query) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  const matches = products
    .filter(product => normalizeText(`${product.name} ${product.category}`).includes(query))
    .slice(0, 5);

  const suggestions = matches.map(product => `
    <button class="suggestion-chip" type="button" data-action="search-suggestion" data-name="${escapeHTML(product.name)}">${escapeHTML(product.name)}</button>
  `).join("");

  box.innerHTML = suggestions || '<span class="suggestion-chip">Press Search to view matching results</span>';
  box.hidden = false;
}

function performSearch(value) {
  searchQuery = String(value || "").trim();
  favoritesOnly = false;
  renderProducts();
  closeSearchPanel();
  if (searchQuery) $("#catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* 9. FAVORITES ---------------------------------------------------- */
function updateFavoritesCount() {
  setText("#favoritesCount", String(favorites.size));
  const button = $("#favoritesButton");
  if (button) {
    button.classList.toggle("active", favoritesOnly);
    button.setAttribute("aria-pressed", String(favoritesOnly));
  }
}

function toggleFavorite(productId) {
  const id = String(productId);
  if (favorites.has(id)) {
    favorites.delete(id);
    showToast("Removed from saved items.");
  } else {
    favorites.add(id);
    showToast("Added to saved items.");
  }
  saveFavorites();
  renderProducts();

  // Keep the favorite control in an open product dialog in sync.
  const modalFavorite = $('#productModalContent [data-action="favorite"]');
  if (modalFavorite && selectedProduct) {
    const saved = favorites.has(selectedProduct.id);
    modalFavorite.textContent = saved ? "♥ Saved" : "♡ Save this item";
    modalFavorite.classList.toggle("is-favorite", saved);
    modalFavorite.setAttribute("aria-pressed", String(saved));
  }
}

function toggleFavoritesView() {
  favoritesOnly = !favoritesOnly;
  activeCategory = "All";
  renderProducts();
  showToast(favoritesOnly ? "Showing your saved items." : "Showing the full collection.");
  $("#catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* 10. PRODUCT DETAILS DIALOG ------------------------------------- */
function openProductModal(productId) {
  const product = products.find(item => item.id === String(productId));
  const modal = $("#productModal");
  const content = $("#productModalContent");
  if (!product || !modal || !content) {
    showToast("Product details are not available.", "error");
    return;
  }

  selectedProduct = product;
  lastFocusedElement = document.activeElement;
  const soldOut = product.stock !== null && product.stock <= 0;
  const noStockData = product.stock === null;
  const image = product.image
    ? `<img class="product-modal-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">`
    : '<div class="product-modal-image-placeholder">JH</div>';
  const saved = favorites.has(product.id);

  content.innerHTML = `
    <div class="product-modal-layout">
      <div class="product-modal-visual">${image}</div>
      <div class="product-modal-details">
        <span class="product-modal-category">${escapeHTML(product.category)}</span>
        <h2>${escapeHTML(product.name)}</h2>
        <p class="product-modal-price">${formatMoney(product.price)}</p>
        <p class="product-modal-description">${escapeHTML(product.description)}</p>
        <p class="product-modal-stock">${escapeHTML(stockLabel(product))}</p>
        <div class="product-modal-actions">
          <button class="product-add-button" type="button" data-action="modal-add" data-id="${escapeHTML(product.id)}" ${soldOut || noStockData ? "disabled" : ""}>${soldOut ? "Out of stock" : noStockData ? "Stock unavailable" : "Add to bag"}</button>
          <button class="product-favorite-button ${saved ? "is-favorite" : ""}" type="button" data-action="favorite" data-id="${escapeHTML(product.id)}" aria-pressed="${saved}">${saved ? "♥ Saved" : "♡ Save this item"}</button>
        </div>
      </div>
    </div>`;

  if (!modal.open) modal.showModal();
}

function closeProductModal() {
  const modal = $("#productModal");
  if (modal?.open) modal.close();
  selectedProduct = null;
}

/* 11. SHOPPING BAG ------------------------------------------------ */
function findCartItem(id) {
  return cart.find(item => item.id === String(id));
}

function addToCart(productId) {
  const product = products.find(item => item.id === String(productId));
  if (!product) {
    showToast("This product is no longer available.", "error");
    return;
  }
  if (product.stock === null) {
    showToast("Stock availability has not been confirmed for this item.", "warning");
    return;
  }
  if (product.stock <= 0) {
    showToast("This item is out of stock.", "error");
    return;
  }

  const existing = findCartItem(product.id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast(`Only ${product.stock} unit(s) are available.`, "warning");
      return;
    }
    existing.quantity += 1;
    existing.stock = product.stock;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      stock: product.stock,
      category: product.category
    });
  }

  saveCart();
  renderCart();
  showToast(`${product.name} added to your bag.`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== String(productId));
  saveCart();
  renderCart();
  showToast("Item removed from your bag.");
}

function changeCartQuantity(productId, amount) {
  const item = findCartItem(productId);
  if (!item) return;
  const product = products.find(entry => entry.id === String(productId));
  const stock = product ? product.stock : item.stock;
  const nextQuantity = item.quantity + amount;

  if (nextQuantity <= 0) {
    removeFromCart(productId);
    return;
  }
  if (amount > 0 && (stock === null || stock === undefined)) {
    showToast("Stock availability has not been confirmed.", "warning");
    return;
  }
  if (stock !== null && stock !== undefined && nextQuantity > stock) {
    showToast(`Only ${stock} unit(s) are available.`, "warning");
    return;
  }

  item.quantity = nextQuantity;
  if (product) item.stock = product.stock;
  saveCart();
  renderCart();
}

function cartCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function cartSubtotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function renderCart() {
  const itemsContainer = $("#cartItems");
  const empty = $("#cartEmpty");
  const summary = $("#cartSummary");
  const isEmpty = cart.length === 0;

  if (empty) empty.hidden = !isEmpty;
  if (summary) summary.hidden = isEmpty;

  if (itemsContainer) {
    itemsContainer.innerHTML = cart.map(item => {
      const image = item.image
        ? `<img class="cart-item-image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" data-cart-image>`
        : '<div class="cart-item-image-placeholder">JH</div>';
      return `
        <article class="cart-item" data-cart-id="${escapeHTML(item.id)}">
          ${image}
          <div class="cart-item-details">
            <h3>${escapeHTML(item.name)}</h3>
            <p class="cart-item-price">${formatMoney(item.price)}</p>
            <div class="cart-item-controls">
              <button type="button" data-action="decrease" data-id="${escapeHTML(item.id)}" aria-label="Decrease ${escapeHTML(item.name)} quantity">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" data-id="${escapeHTML(item.id)}" aria-label="Increase ${escapeHTML(item.name)} quantity">+</button>
            </div>
          </div>
          <div class="cart-item-end">
            <strong>${formatMoney(item.price * item.quantity)}</strong>
            <button class="cart-item-remove" type="button" data-action="remove" data-id="${escapeHTML(item.id)}">Remove</button>
          </div>
        </article>`;
    }).join("");
  }

  setText("#cartSubtotal", formatMoney(cartSubtotal()));
  setText("#drawerCount", `(${cartCount()})`);
  setText("#bagCount", String(cartCount()));
  setText("#mobileCartCount", String(cartCount()));
  const headerCart = $("#headerCartButton");
  const mobileCart = $("#mobileCartButton");
  [headerCart, mobileCart].forEach(button => {
    if (button) button.setAttribute("aria-label", `Open shopping bag, ${cartCount()} ${cartCount() === 1 ? "item" : "items"}`);
  });
}

function openCart() {
  const drawer = $("#cartDrawer");
  const overlay = $("#overlay");
  if (!drawer) return;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  if (overlay) {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }
  document.body.classList.add("cart-open");
  renderCart();
  setTimeout(() => $("#closeCartButton")?.focus(), 100);
}

function closeCart() {
  const drawer = $("#cartDrawer");
  const overlay = $("#overlay");
  if (drawer) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }
  if (overlay) {
    overlay.classList.remove("is-visible");
    setTimeout(() => { if (!overlay.classList.contains("is-visible")) overlay.hidden = true; }, 260);
  }
  document.body.classList.remove("cart-open");
}

/* 12. CHECKOUT LINK ----------------------------------------------- */
function handleCheckoutClick(event) {
  if (!cart.length) {
    event.preventDefault();
    showToast("Your bag is empty.", "warning");
  }
  // A non-empty bag continues to checkout.html. No payment is processed here.
}

/* 13. NEWSLETTER + FOOTER ----------------------------------------- */
function handleNewsletterSubmit(event) {
  event.preventDefault();
  const input = $("#newsletterEmail");
  const message = $("#newsletterMessage");
  if (!input || !input.checkValidity()) {
    if (message) message.textContent = "Please enter a valid email address.";
    input?.reportValidity();
    return;
  }
  if (message) message.textContent = "Newsletter sign-up is not connected yet. Please check back soon.";
  showToast("Newsletter sign-up is not connected yet.", "warning");
}

function updateFooterYear() {
  setText("#currentYear", String(new Date().getFullYear()));
}

/* 14. EVENT LISTENERS --------------------------------------------- */
// Product cards, category tiles, filters and cart controls are rendered dynamically.
document.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    const id = actionButton.dataset.id;

    if (action === "favorite") { toggleFavorite(id); return; }
    if (action === "view") { openProductModal(id); return; }
    if (action === "add" || action === "modal-add") {
      addToCart(id);
      if (action === "modal-add") closeProductModal();
      return;
    }
    if (action === "increase") { changeCartQuantity(id, 1); return; }
    if (action === "decrease") { changeCartQuantity(id, -1); return; }
    if (action === "remove") { removeFromCart(id); return; }
    if (action === "favorites-view") { toggleFavoritesView(); return; }
    if (action === "search-suggestion") {
      const value = actionButton.dataset.name || "";
      if ($("#searchInput")) $("#searchInput").value = value;
      performSearch(value);
      return;
    }
  }

  const categoryTile = event.target.closest("[data-category]");
  if (categoryTile) {
    setCategory(categoryTile.dataset.category || "All");
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    setCategory(filterButton.dataset.filter || "All");
    return;
  }

  const footerCategory = event.target.closest("[data-footer-category]");
  if (footerCategory) {
    setCategory(footerCategory.dataset.footerCategory || "All");
  }
});

const searchForm = $("#shopSearchForm");
searchForm?.addEventListener("submit", event => {
  event.preventDefault();
  performSearch($("#searchInput")?.value || "");
});

$("#searchInput")?.addEventListener("input", event => {
  searchQuery = event.target.value.trim();
  favoritesOnly = false;
  renderProducts();
  renderSearchSuggestions(event.target.value);
});

$("#openSearchButton")?.addEventListener("click", openSearchPanel);
$("#mobileSearchButton")?.addEventListener("click", openSearchPanel);
$("#closeSearch")?.addEventListener("click", closeSearchPanel);
$("#headerCartButton")?.addEventListener("click", openCart);
$("#mobileCartButton")?.addEventListener("click", openCart);
$("#closeCartButton")?.addEventListener("click", closeCart);
$("#continueShopping")?.addEventListener("click", closeCart);
$("#continueShoppingFooter")?.addEventListener("click", closeCart);
$("#overlay")?.addEventListener("click", closeCart);
$("#checkoutButton")?.addEventListener("click", handleCheckoutClick);
$("#favoritesButton")?.addEventListener("click", toggleFavoritesView);
$("#newsletterForm")?.addEventListener("submit", handleNewsletterSubmit);

$("#sortSelect")?.addEventListener("change", renderProducts);
$("#inStockOnly")?.addEventListener("change", renderProducts);
$("#applyFiltersButton")?.addEventListener("click", renderProducts);
$("#resetFilters")?.addEventListener("click", resetFilters);
$("#emptyStateReset")?.addEventListener("click", resetFilters);

$("#closeProductModal")?.addEventListener("click", closeProductModal);
const productModal = $("#productModal");
productModal?.addEventListener("click", event => {
  if (event.target === productModal) closeProductModal();
});
productModal?.addEventListener("close", () => {
  selectedProduct = null;
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
});

document.addEventListener("error", event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;

  if (image.matches("[data-product-image]")) {
    const placeholder = document.createElement("div");
    placeholder.className = "product-image-placeholder";
    placeholder.textContent = "JH";
    placeholder.setAttribute("aria-label", "Product image unavailable");
    image.replaceWith(placeholder);
  } else if (image.matches("[data-cart-image]")) {
    const placeholder = document.createElement("div");
    placeholder.className = "cart-item-image-placeholder";
    placeholder.textContent = "JH";
    image.replaceWith(placeholder);
  }
}, true);

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeCart();
  closeSearchPanel();
  if (productModal?.open) closeProductModal();
});

/* 15. INITIALIZE -------------------------------------------------- */
function initializeShop() {
  loadCart();
  loadFavorites();
  updateFooterYear();
  updateFavoritesCount();
  renderCart();
  fetchProducts();
}

initializeShop();
