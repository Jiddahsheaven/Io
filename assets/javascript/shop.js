/* ============================================================
   JIDDERHS HEAVEN — PREMIUM SHOP JAVASCRIPT
   Features:
   - Supabase product loading
   - Product category mapping
   - Search and search suggestions
   - Category filters
   - Price and stock filters
   - Product sorting
   - Product details modal
   - Shopping bag drawer
   - Quantity controls
   - Stock-aware add-to-bag
   - Cart saved in localStorage
   - Favorites
   - Mobile cart and search controls
   - Toast notifications
   - Newsletter connection status
   ============================================================ */

import { supabase } from "./supabase.js";

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const CONFIG = {
  cartKey: "jiddamarh-cart",
  favoritesKey: "jidderhs-heaven-favorites",
  productsTable: "products",
  currency: "NGN",
  locale: "en-NG"
};

const CATEGORY_MAP = {
  apparel: "Fashion",
  fashion: "Fashion",

  kitchen: "Home & Living",
  home: "Home & Living",
  "home & living": "Home & Living",
  home_living: "Home & Living",

  beauty: "Beauty",
  toiletries: "Beauty",
  skincare: "Beauty",
  cosmetics: "Beauty",

  electronics: "Electronics",
  sports: "Sports",
  accessories: "Accessories"
};

const CATEGORY_ALIASES = {
  clothes: "Fashion",
  clothing: "Fashion",
  outfit: "Fashion",
  outfits: "Fashion",
  abaya: "Fashion",

  cookware: "Home & Living",
  utensils: "Home & Living",
  kitchenware: "Home & Living",
  glassware: "Home & Living",

  makeup: "Beauty",
  make_up: "Beauty",
  cosmetics: "Beauty",
  skincare: "Beauty",
  "skin care": "Beauty",
  face: "Beauty",

  gadgets: "Electronics",
  tech: "Electronics",

  accessory: "Accessories"
};

const moneyFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency",
  currency: CONFIG.currency,
  maximumFractionDigits: 2
});

/* ============================================================
   2. DOM HELPERS
   ============================================================ */

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function formatMoney(amount) {
  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return moneyFormatter.format(0);
  }

  return moneyFormatter.format(number);
}

function normalizeText(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCategory(category = "") {
  const normalized = normalizeText(category);

  return (
    CATEGORY_MAP[normalized] ||
    CATEGORY_ALIASES[normalized] ||
    (normalized
      ? normalized.replace(/\b\w/g, letter => letter.toUpperCase())
      : "Accessories")
  );
}

function getProductImage(product) {
  return (
    product.image_url ||
    product.image ||
    product.imageUrl ||
    ""
  );
}

function getProductDescription(product) {
  return (
    product.description ||
    "Discover more about this product and its details."
  );
}

function getProductStock(product) {
  const stock = Number(product.stock);

  return Number.isFinite(stock) && stock >= 0
    ? stock
    : null;
}

function isInStock(product) {
  const stock = getProductStock(product);

  // Unknown stock is not treated as confirmed inventory.
  return stock !== null && stock > 0;
}

function showToast(message, type = "success") {
  const toast = $("#toast");

  if (!toast) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  toast.textContent = message;
  toast.classList.remove("show", "success", "error", "warning");

  toast.classList.add(type, "show");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  clearTimeout(showToast.timeout);

  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function setText(selector, value) {
  const element = $(selector);

  if (element) {
    element.textContent = value;
  }
}

/* ============================================================
   3. APPLICATION STATE
   ============================================================ */

let products = [];
let visibleProducts = [];

let activeCategory = "All";
let favoritesOnly = false;
let searchQuery = "";

let cart = [];
let favorites = new Set();

let isLoadingProducts = false;
let productLoadFailed = false;

let selectedProduct = null;
let lastFocusedElement = null;

/* ============================================================
   4. LOCAL STORAGE
   ============================================================ */

function readJSON(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) {
      return fallback;
    }

    return JSON.parse(saved);
  } catch (error) {
    console.warn(`Unable to read localStorage key "${key}".`, error);
    return fallback;
  }
}

function saveCart() {
  try {
    localStorage.setItem(
      CONFIG.cartKey,
      JSON.stringify(cart)
    );
  } catch (error) {
    console.error("Unable to save shopping bag:", error);
    showToast("Your shopping bag could not be saved.", "error");
  }
}

function loadCart() {
  const savedCart = readJSON(CONFIG.cartKey, []);

  if (!Array.isArray(savedCart)) {
    cart = [];
    return;
  }

  cart = savedCart
    .map(item => {
      const id = item.id ?? item.product_id;

      const quantity = Math.max(
        1,
        Math.floor(Number(item.quantity) || 1)
      );

      return {
        id: String(id ?? ""),
        name: String(item.name || item.title || "Product"),
        price: Number(item.price) || 0,
        image: String(
          item.image ||
          item.image_url ||
          ""
        ),
        quantity,
        stock: Number.isFinite(Number(item.stock))
          ? Number(item.stock)
          : null,
        category: String(item.category || "Accessories")
      };
    })
    .filter(item => item.id);
}

function saveFavorites() {
  try {
    localStorage.setItem(
      CONFIG.favoritesKey,
      JSON.stringify([...favorites])
    );
  } catch (error) {
    console.warn("Unable to save favorites:", error);
  }
}

function loadFavorites() {
  const saved = readJSON(CONFIG.favoritesKey, []);

  favorites = new Set(
    Array.isArray(saved) ? saved.map(String) : []
  );
}

/* ============================================================
   5. PRODUCT DATA
   ============================================================ */

function normalizeProduct(rawProduct) {
  const id = rawProduct.id;

  return {
    id: String(id),
    databaseId: id,

    name: String(
      rawProduct.name ||
      rawProduct.title ||
      "Untitled product"
    ),

    description: getProductDescription(rawProduct),

    category: normalizeCategory(rawProduct.category),

    price: Number(rawProduct.price) || 0,

    image: getProductImage(rawProduct),

    stock: getProductStock(rawProduct),

    isActive: rawProduct.is_active !== false,

    createdAt: rawProduct.created_at || "",

    rating: Number(rawProduct.rating) || 0,

    featured: rawProduct.is_featured === true
  };
}

async function fetchProducts() {
  if (isLoadingProducts) {
    return;
  }

  isLoadingProducts = true;
  productLoadFailed = false;

  const loadingState = $("#loadingState");
  const productGrid = $("#productGrid");
  const emptyState = $("#emptyState");

  if (loadingState) {
    loadingState.hidden = false;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }

  if (productGrid) {
    productGrid.innerHTML = "";
  }

  try {
    const { data, error } = await supabase
      .from(CONFIG.productsTable)
      .select(
        "id,name,description,category,price,image_url,stock,is_active,created_at"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    products = (data || []).map(normalizeProduct);

    productLoadFailed = false;

    renderProducts();
    updateCartDisplay();

    if (products.length === 0) {
      showEmptyState(
        "No products are available right now. Please check back soon."
      );
    }
  } catch (error) {
    console.error("Unable to load products from Supabase:", error);

    products = [];
    visibleProducts = [];
    productLoadFailed = true;

    renderProducts();

    showEmptyState(
      "We couldn't load the products. Check your internet connection and Supabase access, then refresh the page."
    );

    showToast(
      "Unable to load products. Please try again.",
      "error"
    );
  } finally {
    isLoadingProducts = false;

    if (loadingState) {
      loadingState.hidden = true;
    }

    updateResultsCount();
  }
}

/* ============================================================
   6. PRODUCT CARD RENDERING
   ============================================================ */

function getStockLabel(product) {
  const stock = getProductStock(product);

  if (stock === null) {
    return "Stock unavailable";
  }

  if (stock <= 0) {
    return "Out of stock";
  }

  if (stock <= 5) {
    return `Only ${stock} left`;
  }

  return "In stock";
}

function getProductImageMarkup(product) {
  const image = product.image
    ? `
      <img
        class="product-image"
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        data-product-image
      >
    `
    : `
      <div class="product-image-placeholder" aria-label="No product image available">
        <span>JH</span>
      </div>
    `;

  return image;
}

function renderProductCard(product) {
  const favorite = favorites.has(String(product.id));

  const stock = getProductStock(product);

  const soldOut = stock !== null && stock <= 0;

  return `
    <article
      class="product-card"
      data-product-id="${escapeHTML(product.id)}"
    >
      <div class="product-card-image-wrap">

        ${getProductImageMarkup(product)}

        <span class="product-category-label">
          ${escapeHTML(product.category)}
        </span>

        <button
          class="product-favorite-button ${favorite ? "is-favorite" : ""}"
          type="button"
          data-action="favorite"
          data-id="${escapeHTML(product.id)}"
          aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}"
          aria-pressed="${favorite}"
        >
          ${favorite ? "♥" : "♡"}
        </button>

        ${
          soldOut
            ? `
              <span class="product-stock-badge sold-out">
                Out of stock
              </span>
            `
            : ""
        }

      </div>

      <div class="product-card-content">

        <p class="product-stock-text">
          ${escapeHTML(getStockLabel(product))}
        </p>

        <h3 class="product-title">
          ${escapeHTML(product.name)}
        </h3>

        <p class="product-description">
          ${escapeHTML(product.description)}
        </p>

        <div class="product-card-bottom">

          <strong class="product-price">
            ${formatMoney(product.price)}
          </strong>

          <button
            class="product-view-button"
            type="button"
            data-action="view"
            data-id="${escapeHTML(product.id)}"
          >
            View details
          </button>

        </div>

        <button
          class="product-add-button"
          type="button"
          data-action="add"
          data-id="${escapeHTML(product.id)}"
          ${soldOut ? "disabled" : ""}
        >
          ${soldOut ? "Out of stock" : "Add to bag"}
        </button>

      </div>
    </article>
  `;
}

function renderProducts() {
  const grid = $("#productGrid");

  if (!grid) {
    console.error("Product grid #productGrid was not found.");
    return;
  }

  const filtered = getFilteredProducts();

  visibleProducts = filtered;

  grid.innerHTML = filtered
    .map(renderProductCard)
    .join("");

  const emptyState = $("#emptyState");

  if (emptyState) {
    emptyState.hidden = filtered.length > 0;
  }

  updateResultsCount();
  updateActiveCategoryButtons();
}

function showEmptyState(message) {
  const emptyState = $("#emptyState");

  if (!emptyState) {
    return;
  }

  emptyState.hidden = false;

  const paragraph = $("p", emptyState);

  if (paragraph) {
    paragraph.textContent = message;
  } else {
    emptyState.textContent = message;
  }
}

/* ============================================================
   7. SEARCH, CATEGORIES AND FILTERS
   ============================================================ */

function getSearchTerms(query) {
  const normalized = normalizeText(query);

  if (!normalized) {
    return [];
  }

  const terms = [normalized];

  const alias = CATEGORY_ALIASES[normalized];

  if (alias) {
    terms.push(normalizeText(alias));
  }

  if (CATEGORY_MAP[normalized]) {
    terms.push(normalizeText(CATEGORY_MAP[normalized]));
  }

  if (
    normalized.includes("makeup") ||
    normalized.includes("cosmetic")
  ) {
    terms.push("beauty", "make up", "skincare");
  }

  if (
    normalized.includes("clothes") ||
    normalized.includes("clothing")
  ) {
    terms.push("fashion", "apparel", "abaya");
  }

  if (
    normalized.includes("kitchen") ||
    normalized.includes("utensil")
  ) {
    terms.push("home living", "glassware", "cutlery");
  }

  if (
    normalized.includes("skincare") ||
    normalized.includes("skin care")
  ) {
    terms.push("beauty", "toiletries", "face");
  }

  return [...new Set(terms)];
}

function matchesSearch(product) {
  if (!searchQuery.trim()) {
    return true;
  }

  const terms = getSearchTerms(searchQuery);

  const searchableText = normalizeText([
    product.name,
    product.description,
    product.category
  ].join(" "));

  return terms.some(term => searchableText.includes(term));
}

function getFilteredProducts() {
  let result = [...products];

  if (activeCategory !== "All") {
    result = result.filter(product => {
      return normalizeCategory(product.category) === activeCategory;
    });
  }

  result = result.filter(matchesSearch);

  if (favoritesOnly) {
    result = result.filter(product =>
      favorites.has(String(product.id))
    );
  }

  const stockOnly = $("#inStockOnly");

  if (stockOnly?.checked) {
    result = result.filter(product => isInStock(product));
  }

  const minInput = $("#minimumPrice");
  const maxInput = $("#maximumPrice");

  const minPrice = minInput && minInput.value !== ""
    ? Number(minInput.value)
    : null;

  const maxPrice = maxInput && maxInput.value !== ""
    ? Number(maxInput.value)
    : null;

  if (minPrice !== null && Number.isFinite(minPrice)) {
    result = result.filter(product => product.price >= minPrice);
  }

  if (maxPrice !== null && Number.isFinite(maxPrice)) {
    result = result.filter(product => product.price <= maxPrice);
  }

  const sortSelect = $("#sortSelect");
  const sortValue = sortSelect?.value || "default";

  switch (sortValue) {
    case "price-low":
    case "price-asc":
    case "low-to-high":
      result.sort((a, b) => a.price - b.price);
      break;

    case "price-high":
    case "price-desc":
    case "high-to-low":
      result.sort((a, b) => b.price - a.price);
      break;

    case "name-asc":
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;

    case "name-desc":
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;

    case "newest":
      result.sort((a, b) => {
        return new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0);
      });
      break;

    case "featured":
      result.sort((a, b) => Number(b.featured) - Number(a.featured));
      break;

    default:
      break;
  }

  return result;
}

function updateResultsCount() {
  const resultsCount = $("#resultsCount");

  if (!resultsCount) {
    return;
  }

  const count = visibleProducts.length;

  resultsCount.textContent =
    `${count} ${count === 1 ? "product" : "products"}`;
}

function updateActiveCategoryButtons() {
  const filterButtons = $$("[data-filter]");

  filterButtons.forEach(button => {
    const category = button.dataset.filter || "All";

    const isActive = normalizeCategory(category) === activeCategory ||
      (category === "All" && activeCategory === "All");

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  $$("[data-category]").forEach(card => {
    const category = normalizeCategory(card.dataset.category || "");

    card.classList.toggle(
      "active",
      category === activeCategory
    );
  });
}

function setCategory(category) {
  activeCategory = category === "All"
    ? "All"
    : normalizeCategory(category);

  favoritesOnly = false;

  renderProducts();
}

function resetFilters() {
  activeCategory = "All";
  favoritesOnly = false;
  searchQuery = "";

  const searchInput = $("#searchInput");

  if (searchInput) {
    searchInput.value = "";
  }

  const minimumPrice = $("#minimumPrice");
  const maximumPrice = $("#maximumPrice");
  const inStockOnly = $("#inStockOnly");
  const sortSelect = $("#sortSelect");

  if (minimumPrice) minimumPrice.value = "";
  if (maximumPrice) maximumPrice.value = "";
  if (inStockOnly) inStockOnly.checked = false;
  if (sortSelect) sortSelect.value = "default";

  renderProducts();
}

/* ============================================================
   8. SEARCH PANEL
   ============================================================ */

function openSearchPanel() {
  const panel = $("#searchPanel");

  if (!panel) {
    return;
  }

  panel.hidden = false;
  panel.classList.add("is-open");

  const input = $("#searchInput");

  if (input) {
    setTimeout(() => input.focus(), 100);
  }
}

function closeSearchPanel() {
  const panel = $("#searchPanel");

  if (!panel) {
    return;
  }

  panel.classList.remove("is-open");
  panel.hidden = true;
}

function performSearch(value) {
  searchQuery = String(value || "").trim();

  favoritesOnly = false;

  renderProducts();

  const shopSection = $("#productGrid");

  if (shopSection && searchQuery) {
    shopSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

/* ============================================================
   9. FAVORITES
   ============================================================ */

function toggleFavorite(productId) {
  const id = String(productId);

  if (favorites.has(id)) {
    favorites.delete(id);
    showToast("Removed from favorites.");
  } else {
    favorites.add(id);
    showToast("Added to favorites.");
  }

  saveFavorites();
  updateFavoritesCount();
  renderProducts();
}

function updateFavoritesCount() {
  const count = favorites.size;

  setText("#favoritesCount", String(count));

  const button = $("#favoritesButton");

  if (button) {
    button.setAttribute(
      "aria-pressed",
      String(favoritesOnly)
    );

    button.classList.toggle("active", favoritesOnly);
  }
}

function toggleFavoritesView() {
  favoritesOnly = !favoritesOnly;

  activeCategory = "All";

  renderProducts();

  if (favoritesOnly) {
    showToast("Showing your favorite products.");
  } else {
    showToast("Showing all products.");
  }
}

/* ============================================================
   10. PRODUCT DETAILS MODAL
   ============================================================ */

function openProductModal(productId) {
  const product = products.find(
    item => String(item.id) === String(productId)
  );

  if (!product) {
    showToast("This product could not be found.", "error");
    return;
  }

  const modal = $("#productModal");
  const content = $("#productModalContent");

  if (!modal || !content) {
    showToast("Product details are unavailable.", "error");
    return;
  }

  selectedProduct = product;
  lastFocusedElement = document.activeElement;

  const stock = getProductStock(product);

  const soldOut = stock !== null && stock <= 0;

  const imageMarkup = product.image
    ? `
      <img
        class="product-modal-image"
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.name)}"
      >
    `
    : `
      <div class="product-modal-image-placeholder">
        JH
      </div>
    `;

  content.innerHTML = `
    <div class="product-modal-layout">

      <div class="product-modal-visual">
        ${imageMarkup}
      </div>

      <div class="product-modal-details">

        <span class="product-modal-category">
          ${escapeHTML(product.category)}
        </span>

        <h2>${escapeHTML(product.name)}</h2>

        <p class="product-modal-price">
          ${formatMoney(product.price)}
        </p>

        <p class="product-modal-description">
          ${escapeHTML(product.description)}
        </p>

        <p class="product-modal-stock">
          ${escapeHTML(getStockLabel(product))}
        </p>

        <div class="product-modal-actions">

          <button
            type="button"
            class="product-add-button"
            data-action="modal-add"
            data-id="${escapeHTML(product.id)}"
            ${soldOut ? "disabled" : ""}
          >
            ${soldOut ? "Out of stock" : "Add to bag"}
          </button>

          <button
            type="button"
            class="product-favorite-button"
            data-action="favorite"
            data-id="${escapeHTML(product.id)}"
          >
            ${favorites.has(String(product.id))
              ? "♥ Saved"
              : "♡ Save to favorites"}
          </button>

        </div>

      </div>

    </div>
  `;

  if (!modal.open) {
    modal.showModal();
  }
}

function closeProductModal() {
  const modal = $("#productModal");

  if (modal?.open) {
    modal.close();
  }

  selectedProduct = null;
}

/* ============================================================
   11. SHOPPING BAG
   ============================================================ */

function getCartItem(productId) {
  return cart.find(
    item => String(item.id) === String(productId)
  );
}

function getCartQuantity(productId) {
  const item = getCartItem(productId);

  return item ? item.quantity : 0;
}

function addToCart(productId) {
  const product = products.find(
    item => String(item.id) === String(productId)
  );

  if (!product) {
    showToast("This product is no longer available.", "error");
    return;
  }

  const stock = getProductStock(product);

  if (stock === null) {
    showToast(
      "Stock availability is unknown. Please try again later.",
      "warning"
    );
    return;
  }

  if (stock <= 0) {
    showToast("This product is out of stock.", "error");
    return;
  }

  const existingItem = getCartItem(product.id);

  if (existingItem) {
    if (existingItem.quantity >= stock) {
      showToast(
        `Only ${stock} unit(s) are available.`,
        "warning"
      );
      return;
    }

    existingItem.quantity += 1;
    existingItem.stock = stock;
  } else {
    cart.push({
      id: String(product.id),
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      stock,
      category: product.category
    });
  }

  saveCart();
  updateCartDisplay();

  showToast(`${product.name} added to your bag.`);
}

function removeFromCart(productId) {
  cart = cart.filter(
    item => String(item.id) !== String(productId)
  );

  saveCart();
  updateCartDisplay();

  showToast("Product removed from your bag.");
}

function changeCartQuantity(productId, change) {
  const item = getCartItem(productId);

  if (!item) {
    return;
  }

  const product = products.find(
    entry => String(entry.id) === String(productId)
  );

  const currentStock = product
    ? getProductStock(product)
    : item.stock;

  const newQuantity = item.quantity + change;

  if (newQuantity <= 0) {
    removeFromCart(productId);
    return;
  }

  if (
    currentStock !== null &&
    currentStock !== undefined &&
    newQuantity > currentStock
  ) {
    showToast(
      `Only ${currentStock} unit(s) are available.`,
      "warning"
    );
    return;
  }

  item.quantity = newQuantity;

  saveCart();
  updateCartDisplay();
}

function getCartCount() {
  return cart.reduce(
    (total, item) => total + item.quantity,
    0
  );
}

function getCartSubtotal() {
  return cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
}

function renderCart() {
  const cartItems = $("#cartItems");
  const cartEmpty = $("#cartEmpty");
  const cartSummary = $("#cartSummary");

  const isEmpty = cart.length === 0;

  if (cartEmpty) {
    cartEmpty.hidden = !isEmpty;
  }

  if (cartSummary) {
    cartSummary.hidden = isEmpty;
  }

  if (cartItems) {
    cartItems.innerHTML = cart.map(item => {
      const image = item.image
        ? `
          <img
            src="${escapeHTML(item.image)}"
            alt="${escapeHTML(item.name)}"
            class="cart-item-image"
          >
        `
        : `
          <div class="cart-item-image-placeholder">JH</div>
        `;

      return `
        <article class="cart-item" data-cart-id="${escapeHTML(item.id)}">

          ${image}

          <div class="cart-item-details">

            <h3>${escapeHTML(item.name)}</h3>

            <p class="cart-item-price">
              ${formatMoney(item.price)}
            </p>

            <div class="cart-item-controls">

              <button
                type="button"
                data-action="decrease"
                data-id="${escapeHTML(item.id)}"
                aria-label="Decrease quantity of ${escapeHTML(item.name)}"
              >
                −
              </button>

              <span aria-label="Quantity">
                ${item.quantity}
              </span>

              <button
                type="button"
                data-action="increase"
                data-id="${escapeHTML(item.id)}"
                aria-label="Increase quantity of ${escapeHTML(item.name)}"
              >
                +
              </button>

            </div>

          </div>

          <div class="cart-item-end">

            <strong>
              ${formatMoney(item.price * item.quantity)}
            </strong>

            <button
              type="button"
              class="cart-item-remove"
              data-action="remove"
              data-id="${escapeHTML(item.id)}"
            >
              Remove
            </button>

          </div>

        </article>
      `;
    }).join("");
  }

  setText("#cartSubtotal", formatMoney(getCartSubtotal()));
  setText("#drawerCount", String(getCartCount()));

  updateCartCountBadges();
}

function updateCartCountBadges() {
  const count = getCartCount();

  setText("#cartCount", String(count));
  setText("#mobileCartCount", String(count));

  const cartButtons = [
    $("#openCartButton"),
    $("#mobileCartButton")
  ];

  cartButtons.forEach(button => {
    if (button) {
      button.setAttribute(
        "aria-label",
        `Open shopping bag, ${count} ${count === 1 ? "item" : "items"}`
      );
    }
  });
}

function updateCartDisplay() {
  renderCart();
}

function openCart() {
  const drawer = $("#cartDrawer");
  const overlay = $("#overlay");

  if (!drawer) {
    showToast("The shopping bag could not be opened.", "error");
    return;
  }

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");

  if (overlay) {
    overlay.hidden = false;

    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
    });
  }

  document.body.classList.add("cart-open");

  renderCart();

  const closeButton = $("#closeCartButton");

  if (closeButton) {
    setTimeout(() => closeButton.focus(), 100);
  }
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

    setTimeout(() => {
      if (!overlay.classList.contains("is-visible")) {
        overlay.hidden = true;
      }
    }, 250);
  }

  document.body.classList.remove("cart-open");
}

/* ============================================================
   12. CART CHECKOUT LINK
   ============================================================ */

function handleCheckoutClick(event) {
  if (cart.length === 0) {
    event.preventDefault();

    showToast(
      "Your shopping bag is empty.",
      "warning"
    );

    return;
  }

  /*
   * The checkout page should read the same localStorage key:
   * jiddamarh-cart
   *
   * This handler does not process payment. Payment processing
   * must be handled by the secure checkout/payment integration.
   */
}

/* ============================================================
   13. NEWSLETTER
   ============================================================ */

function handleNewsletterSubmit(event) {
  event.preventDefault();

  const emailInput = $("#newsletterEmail");
  const message = $("#newsletterMessage");

  if (!emailInput || !emailInput.value.trim()) {
    if (message) {
      message.textContent = "Please enter your email address.";
    }

    return;
  }

  if (!emailInput.checkValidity()) {
    if (message) {
      message.textContent = "Please enter a valid email address.";
    }

    return;
  }

  /*
   * No newsletter table or email service has been connected yet.
   * Do not pretend that the email has been subscribed.
   */

  if (message) {
    message.textContent =
      "Newsletter sign-up is not connected yet. Please check back soon.";
  }

  showToast(
    "Newsletter sign-up is not connected yet.",
    "warning"
  );
}

/* ============================================================
   14. YEAR IN FOOTER
   ============================================================ */

function updateFooterYear() {
  setText("#currentYear", String(new Date().getFullYear()));
}

/* ============================================================
   15. IMAGE ERROR HANDLING
   ============================================================ */

document.addEventListener("error", event => {
  const image = event.target;

  if (
    !(image instanceof HTMLImageElement) ||
    !image.matches("[data-product-image]")
  ) {
    return;
  }

  const placeholder = document.createElement("div");

  placeholder.className = "product-image-placeholder";
  placeholder.textContent = "JH";
  placeholder.setAttribute("aria-label", "Product image unavailable");

  image.replaceWith(placeholder);
}, true);

/* ============================================================
   16. CLICK EVENTS
   ============================================================ */

document.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");

  if (actionButton) {
    const action = actionButton.dataset.action;
    const id = actionButton.dataset.id;

    if (action === "favorite") {
      toggleFavorite(id);
      return;
    }

    if (action === "view") {
      openProductModal(id);
      return;
    }

    if (action === "add" || action === "modal-add") {
      addToCart(id);

      if (action === "modal-add") {
        closeProductModal();
      }

      return;
    }

    if (action === "increase") {
      changeCartQuantity(id, 1);
      return;
    }

    if (action === "decrease") {
      changeCartQuantity(id, -1);
      return;
    }

    if (action === "remove") {
      removeFromCart(id);
      return;
    }
  }

  const categoryCard = event.target.closest("[data-category]");

  if (categoryCard) {
    setCategory(categoryCard.dataset.category);
    return;
  }

  const filterButton = event.target.closest("[data-filter]");

  if (filterButton) {
    setCategory(filterButton.dataset.filter || "All");
  }
});

/* ============================================================
   17. FORM EVENTS
   ============================================================ */

const searchForm = $("#shopSearchForm");

if (searchForm) {
  searchForm.addEventListener("submit", event => {
    event.preventDefault();

    performSearch($("#searchInput")?.value || "");
    closeSearchPanel();
  });
}

const searchInput = $("#searchInput");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();

    favoritesOnly = false;

    renderProducts();
  });
}

const newsletterForm = $("#newsletterForm");

if (newsletterForm) {
  newsletterForm.addEventListener(
    "submit",
    handleNewsletterSubmit
  );
}

/* ============================================================
   18. FILTER EVENTS
   ============================================================ */

const sortSelect = $("#sortSelect");

if (sortSelect) {
  sortSelect.addEventListener("change", renderProducts);
}

const stockFilter = $("#inStockOnly");

if (stockFilter) {
  stockFilter.addEventListener("change", renderProducts);
}

const applyFiltersButton = $("#applyFiltersButton");

if (applyFiltersButton) {
  applyFiltersButton.addEventListener("click", renderProducts);
}

const resetFiltersButton = $("#resetFilters");

if (resetFiltersButton) {
  resetFiltersButton.addEventListener("click", resetFilters);
}

const emptyStateResetButton = $("#emptyStateReset");

if (emptyStateResetButton) {
  emptyStateResetButton.addEventListener("click", resetFilters);
}

const showAllButton = $("#showAllButton");

if (showAllButton) {
  showAllButton.addEventListener("click", resetFilters);
}

/* ============================================================
   19. SEARCH PANEL BUTTONS
   ============================================================ */

const searchToggle = $("#searchToggle");

if (searchToggle) {
  searchToggle.addEventListener("click", () => {
    const panel = $("#searchPanel");

    if (panel && !panel.hidden) {
      closeSearchPanel();
    } else {
      openSearchPanel();
    }
  });
}

const mobileSearchButton = $("#mobileSearchButton");

if (mobileSearchButton) {
  mobileSearchButton.addEventListener("click", openSearchPanel);
}

const closeSearchButton = $("#closeSearch");

if (closeSearchButton) {
  closeSearchButton.addEventListener("click", closeSearchPanel);
}

/* ============================================================
   20. CART DRAWER BUTTONS
   ============================================================ */

const openCartButton = $("#openCartButton");

if (openCartButton) {
  openCartButton.addEventListener("click", openCart);
}

const mobileCartButton = $("#mobileCartButton");

if (mobileCartButton) {
  mobileCartButton.addEventListener("click", openCart);
}

const closeCartButton = $("#closeCartButton");

if (closeCartButton) {
  closeCartButton.addEventListener("click", closeCart);
}

const continueShoppingButton = $("#continueShopping");

if (continueShoppingButton) {
  continueShoppingButton.addEventListener("click", closeCart);
}

const overlay = $("#overlay");

if (overlay) {
  overlay.addEventListener("click", closeCart);
}

const checkoutButton = $("#checkoutButton");

if (checkoutButton) {
  checkoutButton.addEventListener("click", handleCheckoutClick);
}

/* ============================================================
   21. FAVORITES BUTTON
   ============================================================ */

const favoritesButton = $("#favoritesButton");

if (favoritesButton) {
  favoritesButton.addEventListener("click", toggleFavoritesView);
}

/* ============================================================
   22. PRODUCT MODAL BUTTONS
   ============================================================ */

const closeProductModalButton = $("#closeProductModal");

if (closeProductModalButton) {
  closeProductModalButton.addEventListener(
    "click",
    closeProductModal
  );
}

const productModal = $("#productModal");

if (productModal) {
  productModal.addEventListener("click", event => {
    /*
     * Close only when clicking the dialog backdrop,
     * not when clicking the modal content.
     */
    if (event.target === productModal) {
      closeProductModal();
    }
  });

  productModal.addEventListener("close", () => {
    selectedProduct = null;

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  });
}

/* ============================================================
   23. KEYBOARD ACCESSIBILITY
   ============================================================ */

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") {
    return;
  }

  closeCart();
  closeSearchPanel();

  if (productModal?.open) {
    closeProductModal();
  }
});

/* ============================================================
   24. INITIALIZE SHOP
   ============================================================ */

function initializeShop() {
  loadCart();
  loadFavorites();

  updateFooterYear();
  updateFavoritesCount();
  updateCartDisplay();

  /*
   * Load real active products from Supabase.
   */
  fetchProducts();
}

initializeShop();

/* ============================================================
   END OF JIDDERHS HEAVEN SHOP JAVASCRIPT
   ============================================================ */