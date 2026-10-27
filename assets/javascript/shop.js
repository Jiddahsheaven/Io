/* =========================================================
   JIDDERHS HEAVEN — PREMIUM SHOP
   File: assets/javascript/shop.js

   Features:
   - Supabase product loading
   - Search and category filters
   - Price filters and sorting
   - Favorites saved in localStorage
   - Shopping bag saved in localStorage
   - Product details modal
   - Responsive mobile filters
   - Pagination
   ========================================================= */

import { supabase } from "./supabase.js";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const CART_KEY = "jiddamarh-cart";
const FAVORITES_KEY = "jiddamarh-favorites";
const PRODUCTS_PER_PAGE = 12;

const CURRENCY = "NGN";

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

let products = [];
let filteredProducts = [];
let currentPage = 1;
let searchTerm = "";
let selectedCategory = "";
let showInStockOnly = false;
let favoritesOnly = false;
let currentSort = "newest";
let selectedProduct = null;

let cart = readStorage(CART_KEY, []);
let favorites = readStorage(FAVORITES_KEY, []);

const money = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));

    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Unable to save local data:", error);
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return replacements[character];
  });
}

function productId(product) {
  return String(product.id);
}

function findProduct(id) {
  return products.find(
    (product) => productId(product) === String(id)
  );
}

function getProductImage(product) {
  return product.image_url || "";
}

function getProductStock(product) {
  const stock = Number(product.stock);

  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function isFavorite(id) {
  return favorites.includes(String(id));
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function showToast(message) {
  let toast = $("#jhShopToast");

  if (!toast) {
    toast = document.createElement("div");

    toast.id = "jhShopToast";
    toast.className = "shop-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

/* =========================================================
   ELEMENT CREATION
   ========================================================= */

function createElement(tag, className, text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
}

/* =========================================================
   HEADER HELPERS
   ========================================================= */

function updateHeaderCounts() {
  const bagCount = cart.reduce(
    (total, item) => total + Math.max(0, Number(item.quantity) || 0),
    0
  );

  const bagCountElement = $("#shopBagCount");

  if (bagCountElement) {
    bagCountElement.textContent = String(bagCount);
  }

  const favoritesCountElement = $("#shopFavoritesCount");

  if (favoritesCountElement) {
    favoritesCountElement.textContent = String(favorites.length);
  }

  $$("[data-favorite-count]").forEach((element) => {
    element.textContent = String(favorites.length);
  });
}

/* =========================================================
   LOAD PRODUCTS FROM SUPABASE
   ========================================================= */

async function loadProducts() {
  const grid = $("#shopProductGrid");
  const message = $("#shopMessage");

  if (message) {
    message.textContent = "Loading products...";
    message.hidden = false;
  }

  if (grid) {
    grid.replaceChildren();
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, description, category, price, image_url, stock, is_active, created_at"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    products = Array.isArray(data) ? data : [];

    if (message) {
      message.hidden = true;
    }

    applyFilters();

  } catch (error) {
    console.error("Product loading error:", error);

    if (message) {
      message.textContent =
        "We couldn't load the products. Please refresh and try again.";
      message.hidden = false;
    }

    if (grid) {
      grid.replaceChildren();
    }

    updateResultCount(0);
  }
}

/* =========================================================
   SEARCH AND FILTERS
   ========================================================= */

function getMinPrice() {
  const input = $("#shopMinPrice");

  if (!input || input.value.trim() === "") {
    return 0;
  }

  const value = Number(input.value);

  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getMaxPrice() {
  const input = $("#shopMaxPrice");

  if (!input || input.value.trim() === "") {
    return Infinity;
  }

  const value = Number(input.value);

  return Number.isFinite(value) ? Math.max(0, value) : Infinity;
}

function applyFilters() {
  const minPrice = getMinPrice();
  const maxPrice = getMaxPrice();

  filteredProducts = products.filter((product) => {
    const name = String(product.name || "").toLowerCase();

    const description = String(
      product.description || ""
    ).toLowerCase();

    const category = String(
      product.category || ""
    ).toLowerCase();

    const matchesSearch =
      !searchTerm ||
      name.includes(searchTerm) ||
      description.includes(searchTerm) ||
      category.includes(searchTerm);

    const matchesCategory =
      !selectedCategory ||
      category === selectedCategory.toLowerCase();

    const price = Number(product.price) || 0;

    const matchesPrice =
      price >= minPrice &&
      price <= maxPrice;

    const matchesStock =
      !showInStockOnly ||
      getProductStock(product) > 0;

    const matchesFavorites =
      !favoritesOnly ||
      isFavorite(product.id);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesPrice &&
      matchesStock &&
      matchesFavorites
    );
  });

  sortProducts();

  currentPage = 1;

  renderProducts();
  updateResultCount(filteredProducts.length);
  updateLoadMoreButton();
}

function sortProducts() {
  const sortElement = $("#shopSort");

  if (sortElement && sortElement.value) {
    currentSort = sortElement.value;
  }

  switch (currentSort) {
    case "price-low":
    case "price-asc":
    case "price_asc":
      filteredProducts.sort(
        (a, b) => Number(a.price) - Number(b.price)
      );
      break;

    case "price-high":
    case "price-desc":
    case "price_desc":
      filteredProducts.sort(
        (a, b) => Number(b.price) - Number(a.price)
      );
      break;

    case "name":
    case "name-asc":
      filteredProducts.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
      break;

    case "oldest":
      filteredProducts.sort(
        (a, b) =>
          new Date(a.created_at || 0) -
          new Date(b.created_at || 0)
      );
      break;

    case "newest":
    default:
      filteredProducts.sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      );
  }
}

function updateResultCount(count) {
  const element = $("#shopResultCount");

  if (element) {
    element.textContent =
      `${count} ${count === 1 ? "product" : "products"} found`;
  }
}

/* =========================================================
   PRODUCT CARDS
   ========================================================= */

function createProductCard(product) {
  const card = createElement("article", "shop-product-card");

  const imageWrap = createElement(
    "div",
    "shop-product-image-wrap"
  );

  const image = document.createElement("img");

  image.className = "shop-product-image";
  image.alt = product.name || "Product";
  image.loading = "lazy";
  image.decoding = "async";

  const imageUrl = getProductImage(product);

  if (imageUrl) {
    image.src = imageUrl;
  } else {
    image.alt = `${product.name || "Product"} image unavailable`;
    imageWrap.classList.add("shop-image-unavailable");
  }

  image.addEventListener("error", () => {
    image.removeAttribute("src");
    image.alt = "Product image unavailable";
    imageWrap.classList.add("shop-image-unavailable");
  });

  imageWrap.appendChild(image);

  if (getProductStock(product) === 0) {
    const badge = createElement(
      "span",
      "shop-product-badge",
      "Sold out"
    );

    imageWrap.appendChild(badge);
  }

  const favoriteButton = document.createElement("button");

  favoriteButton.type = "button";
  favoriteButton.className =
    "shop-product-favorite" +
    (isFavorite(product.id) ? " is-favorite" : "");

  favoriteButton.setAttribute(
    "aria-label",
    isFavorite(product.id)
      ? "Remove from favorites"
      : "Add to favorites"
  );

  favoriteButton.setAttribute(
    "aria-pressed",
    String(isFavorite(product.id))
  );

  favoriteButton.textContent = isFavorite(product.id) ? "♥" : "♡";

  favoriteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(product.id);
  });

  imageWrap.appendChild(favoriteButton);

  imageWrap.tabIndex = 0;
  imageWrap.setAttribute(
    "aria-label",
    `View ${product.name || "product"} details`
  );

  imageWrap.addEventListener("click", () => {
    openProductModal(product.id);
  });

  imageWrap.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductModal(product.id);
    }
  });

  const info = createElement("div", "shop-product-info");

  const category = createElement(
    "span",
    "shop-product-category",
    product.category || "General"
  );

  const name = createElement("h3", "shop-product-name");

  name.textContent = product.name || "Untitled product";

  const price = createElement(
    "div",
    "shop-product-price",
    money(product.price)
  );

  const stock = createElement(
    "div",
    "shop-stock-status",
    getProductStock(product) > 0
      ? "In stock"
      : "Out of stock"
  );

  if (getProductStock(product) === 0) {
    stock.classList.add("out-of-stock");
  }

  const bottom = createElement("div", "shop-product-bottom");

  bottom.append(price, stock);

  const actions = createElement("div", "shop-product-actions");

  const addButton = document.createElement("button");

  addButton.type = "button";
  addButton.className = "shop-add-to-cart";
  addButton.textContent =
    getProductStock(product) > 0
      ? "Add to Bag"
      : "Sold Out";

  addButton.disabled = getProductStock(product) <= 0;

  addButton.addEventListener("click", () => {
    addToCart(product.id);
  });

  actions.appendChild(addButton);

  info.append(category, name, bottom, actions);

  card.append(imageWrap, info);

  return card;
}

/* =========================================================
   RENDER PRODUCTS
   ========================================================= */

function renderProducts() {
  const grid = $("#shopProductGrid");
  const message = $("#shopMessage");

  if (!grid) {
    console.error(
      "Missing #shopProductGrid in shop.html."
    );

    return;
  }

  grid.replaceChildren();

  const start = 0;
  const end = currentPage * PRODUCTS_PER_PAGE;

  const visibleProducts = filteredProducts.slice(start, end);

  if (message) {
    message.hidden = true;
  }

  if (visibleProducts.length === 0) {
    const empty = createElement(
      "div",
      "shop-empty-state"
    );

    const title = createElement(
      "h3",
      "",
      favoritesOnly
        ? "No favourites yet"
        : "No products found"
    );

    const description = createElement(
      "p",
      "",
      favoritesOnly
        ? "Tap the heart on a product to save it here."
        : "Try changing your search or filters."
    );

    const clearButton = document.createElement("button");

    clearButton.type = "button";
    clearButton.className = "shop-primary-button";
    clearButton.textContent = "Clear filters";

    clearButton.addEventListener("click", clearFilters);

    empty.append(title, description, clearButton);

    grid.appendChild(empty);

    updateLoadMoreButton();

    return;
  }

  const fragment = document.createDocumentFragment();

  visibleProducts.forEach((product) => {
    fragment.appendChild(createProductCard(product));
  });

  grid.appendChild(fragment);

  updateLoadMoreButton();
}

/* =========================================================
   LOAD MORE
   ========================================================= */

function updateLoadMoreButton() {
  const button = $("#shopLoadMore");

  if (!button) {
    return;
  }

  const hasMore =
    currentPage * PRODUCTS_PER_PAGE < filteredProducts.length;

  button.hidden = !hasMore;
}

function loadMoreProducts() {
  if (currentPage * PRODUCTS_PER_PAGE >= filteredProducts.length) {
    return;
  }

  currentPage += 1;

  renderProducts();
}

/* =========================================================
   FAVORITES
   ========================================================= */

function toggleFavorite(id) {
  const normalizedId = String(id);

  if (isFavorite(normalizedId)) {
    favorites = favorites.filter(
      (favoriteId) => favoriteId !== normalizedId
    );

    showToast("Removed from your favorites.");
  } else {
    favorites.push(normalizedId);

    showToast("Added to your favorites.");
  }

  saveStorage(FAVORITES_KEY, favorites);

  updateHeaderCounts();

  applyFilters();
}

function showFavorites() {
  favoritesOnly = true;

  const heading = $("#shopIntroTitle");

  if (heading) {
    heading.textContent = "Your Favorites";
  }

  applyFilters();

  document
    .querySelector(".shop-main")
    ?.scrollIntoView({ behavior: "smooth" });
}

function showAllProducts() {
  favoritesOnly = false;

  const heading = $("#shopIntroTitle");

  if (heading) {
    heading.textContent = "Discover Your Next Favourite";
  }

  applyFilters();
}

/* =========================================================
   CART
   ========================================================= */

function addToCart(id, quantity = 1) {
  const product = findProduct(id);

  if (!product) {
    showToast("This product is no longer available.");
    return;
  }

  const stock = getProductStock(product);

  if (stock <= 0) {
    showToast("Sorry, this product is out of stock.");
    return;
  }

  const existingItem = cart.find(
    (item) => String(item.id) === String(product.id)
  );

  const requestedQuantity = Math.max(
    1,
    Number(quantity) || 1
  );

  if (existingItem) {
    if (existingItem.quantity + requestedQuantity > stock) {
      showToast(`Only ${stock} item(s) available.`);
      return;
    }

    existingItem.quantity += requestedQuantity;
  } else {
    if (requestedQuantity > stock) {
      showToast(`Only ${stock} item(s) available.`);
      return;
    }

    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image_url: product.image_url || "",
      quantity: requestedQuantity
    });
  }

  saveStorage(CART_KEY, cart);

  updateHeaderCounts();
  renderCart();

  showToast("Added to your shopping bag.");
}

function changeCartQuantity(id, change) {
  const item = cart.find(
    (cartItem) => String(cartItem.id) === String(id)
  );

  if (!item) {
    return;
  }

  const product = findProduct(id);

  if (!product) {
    showToast("This product is no longer available.");
    return;
  }

  const nextQuantity = item.quantity + change;

  if (nextQuantity <= 0) {
    removeCartItem(id);
    return;
  }

  if (nextQuantity > getProductStock(product)) {
    showToast(
      `Only ${getProductStock(product)} item(s) available.`
    );

    return;
  }

  item.quantity = nextQuantity;

  saveStorage(CART_KEY, cart);

  updateHeaderCounts();
  renderCart();
}

function removeCartItem(id) {
  cart = cart.filter(
    (item) => String(item.id) !== String(id)
  );

  saveStorage(CART_KEY, cart);

  updateHeaderCounts();
  renderCart();

  showToast("Item removed from your bag.");
}

/* =========================================================
   CART DRAWER
   ========================================================= */

function createCartDrawer() {
  let overlay = $("#shopBagOverlay");
  let drawer = $("#shopBagDrawer");

  if (overlay && drawer) {
    return { overlay, drawer };
  }

  overlay = createElement("div", "shop-drawer-overlay");
  overlay.id = "shopBagOverlay";
  overlay.hidden = true;

  drawer = createElement("aside", "shop-bag-drawer");
  drawer.id = "shopBagDrawer";

  drawer.setAttribute("aria-label", "Shopping bag");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-hidden", "true");

  const header = createElement("div", "shop-drawer-header");

  const title = createElement("h2", "", "Your Shopping Bag");

  const closeButton = document.createElement("button");

  closeButton.type = "button";
  closeButton.className = "shop-drawer-close";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close shopping bag");

  closeButton.addEventListener("click", closeCart);

  header.append(title, closeButton);

  const items = createElement("div", "shop-bag-items");
  items.id = "shopBagItems";

  const footer = createElement("div", "shop-drawer-footer");

  const subtotal = createElement("div", "shop-bag-subtotal");

  const subtotalLabel = createElement("span", "", "Subtotal");

  const subtotalValue = createElement("strong", "");
  subtotalValue.id = "shopBagSubtotal";

  subtotal.append(subtotalLabel, subtotalValue);

  const checkout = document.createElement("a");

  checkout.className = "shop-checkout-button";
  checkout.href = "./checkout.html";
  checkout.textContent = "Continue to Checkout";

  const note = createElement(
    "p",
    "shop-continue-shopping",
    "Delivery fees, if applicable, are calculated separately."
  );

  footer.append(subtotal, checkout, note);

  drawer.append(header, items, footer);

  document.body.append(overlay, drawer);

  overlay.addEventListener("click", closeCart);

  return { overlay, drawer };
}

function openCart() {
  const { overlay, drawer } = createCartDrawer();

  overlay.hidden = false;

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";

  renderCart();
}

function closeCart() {
  const overlay = $("#shopBagOverlay");
  const drawer = $("#shopBagDrawer");

  if (!overlay || !drawer) {
    return;
  }

  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");

  overlay.hidden = true;

  document.body.style.overflow = "";
}

function renderCart() {
  const { drawer } = createCartDrawer();

  const itemsContainer = $("#shopBagItems");
  const subtotalElement = $("#shopBagSubtotal");

  if (!itemsContainer || !subtotalElement) {
    return;
  }

  itemsContainer.replaceChildren();

  let subtotal = 0;

  if (cart.length === 0) {
    const empty = createElement(
      "div",
      "shop-empty-state"
    );

    empty.append(
      createElement("h3", "", "Your bag is empty"),
      createElement(
        "p",
        "",
        "Discover something special and add it to your bag."
      )
    );

    itemsContainer.appendChild(empty);
  }

  cart = cart.filter((item) => {
    return (
      item &&
      item.id !== undefined &&
      Number(item.quantity) > 0
    );
  });

  cart.forEach((item) => {
    const product = findProduct(item.id);

    if (!product) {
      return;
    }

    item.price = Number(product.price) || 0;
    item.name = product.name;
    item.image_url = product.image_url || "";

    subtotal += item.price * item.quantity;

    const row = createElement("article", "shop-bag-item");

    const image = document.createElement("img");

    image.alt = item.name || "Product";
    image.loading = "lazy";

    if (item.image_url) {
      image.src = item.image_url;
    }

    const details = createElement("div", "shop-bag-item-details");

    const name = createElement(
      "h3",
      "",
      item.name || "Product"
    );

    const price = createElement(
      "p",
      "",
      money(item.price)
    );

    const actions = createElement(
      "div",
      "shop-bag-item-actions"
    );

    const decrease = document.createElement("button");

    decrease.type = "button";
    decrease.className = "shop-quantity-button";
    decrease.textContent = "−";
    decrease.setAttribute("aria-label", "Decrease quantity");

    decrease.addEventListener("click", () => {
      changeCartQuantity(item.id, -1);
    });

    const quantity = createElement(
      "span",
      "",
      String(item.quantity)
    );

    const increase = document.createElement("button");

    increase.type = "button";
    increase.className = "shop-quantity-button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", "Increase quantity");

    increase.addEventListener("click", () => {
      changeCartQuantity(item.id, 1);
    });

    const remove = document.createElement("button");

    remove.type = "button";
    remove.className = "shop-remove-item";
    remove.textContent = "Remove";

    remove.addEventListener("click", () => {
      removeCartItem(item.id);
    });

    actions.append(decrease, quantity, increase, remove);

    details.append(name, price, actions);

    row.append(image, details);

    itemsContainer.appendChild(row);
  });

  saveStorage(CART_KEY, cart);

  subtotalElement.textContent = money(subtotal);

  updateHeaderCounts();

  const checkoutButton = $(
    ".shop-checkout-button",
    drawer
  );

  if (checkoutButton) {
    checkoutButton.setAttribute(
      "aria-disabled",
      String(cart.length === 0)
    );

    checkoutButton.style.opacity =
      cart.length === 0 ? "0.55" : "1";

    checkoutButton.style.pointerEvents =
      cart.length === 0 ? "none" : "auto";
  }
}

/* =========================================================
   PRODUCT DETAILS MODAL
   ========================================================= */

function openProductModal(id) {
  const product = findProduct(id);

  if (!product) {
    return;
  }

  selectedProduct = product;

  let overlay = $("#shopProductModalOverlay");

  if (!overlay) {
    overlay = createElement(
      "div",
      "shop-product-modal-overlay"
    );

    overlay.id = "shopProductModalOverlay";

    const modal = createElement(
      "div",
      "shop-product-modal"
    );

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Product details");

    const close = document.createElement("button");

    close.type = "button";
    close.className = "shop-product-modal-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close product details");

    close.addEventListener("click", closeProductModal);

    const content = createElement(
      "div",
      "shop-product-modal-content"
    );

    content.id = "shopProductModalContent";

    modal.append(close, content);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeProductModal();
      }
    });
  }

  const content = $("#shopProductModalContent");

  content.replaceChildren();

  const imageWrap = createElement(
    "div",
    "shop-product-modal-image"
  );

  const image = document.createElement("img");

  image.alt = product.name || "Product";

  if (product.image_url) {
    image.src = product.image_url;
  }

  imageWrap.appendChild(image);

  const details = createElement(
    "div",
    "shop-product-modal-details"
  );

  details.appendChild(
    createElement(
      "span",
      "shop-product-category",
      product.category || "General"
    )
  );

  details.appendChild(
    createElement(
      "h2",
      "",
      product.name || "Product"
    )
  );

  details.appendChild(
    createElement(
      "div",
      "shop-product-modal-price",
      money(product.price)
    )
  );

  details.appendChild(
    createElement(
      "p",
      "",
      product.description || "Discover more about this product."
    )
  );

  details.appendChild(
    createElement(
      "p",
      "shop-stock-status",
      getProductStock(product) > 0
        ? `${getProductStock(product)} available`
        : "Currently out of stock"
    )
  );

  const addButton = document.createElement("button");

  addButton.type = "button";
  addButton.className = "shop-primary-button";

  addButton.textContent =
    getProductStock(product) > 0
      ? "Add to Shopping Bag"
      : "Out of Stock";

  addButton.disabled = getProductStock(product) <= 0;

  addButton.addEventListener("click", () => {
    addToCart(product.id);
  });

  details.appendChild(addButton);

  content.append(imageWrap, details);

  overlay.hidden = false;

  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  const overlay = $("#shopProductModalOverlay");

  if (overlay) {
    overlay.hidden = true;
  }

  document.body.style.overflow = "";
}

/* =========================================================
   SEARCH PANEL
   ========================================================= */

function setupSearchPanel() {
  const searchButton = $("#shopSearchToggle");

  if (!searchButton || $("#shopSearchPanel")) {
    return;
  }

  const panel = createElement("div", "shop-search-panel");

  panel.id = "shopSearchPanel";
  panel.hidden = true;

  const input = document.createElement("input");

  input.id = "shopSearchInput";
  input.type = "search";
  input.placeholder = "Search products...";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Search products");

  const clearButton = document.createElement("button");

  clearButton.type = "button";
  clearButton.textContent = "Clear search";

  clearButton.addEventListener("click", () => {
    input.value = "";
    searchTerm = "";

    applyFilters();

    input.focus();
  });

  input.addEventListener("input", () => {
    searchTerm = input.value.trim().toLowerCase();

    applyFilters();
  });

  panel.append(input, clearButton);

  const toolbar = $(".shop-toolbar");

  if (toolbar) {
    toolbar.insertAdjacentElement("afterend", panel);
  } else {
    const main = $(".shop-main");

    if (main) {
      main.prepend(panel);
    }
  }

  searchButton.addEventListener("click", () => {
    panel.hidden = !panel.hidden;

    if (!panel.hidden) {
      input.focus();
    }
  });
}

/* =========================================================
   FILTER EVENTS
   ========================================================= */

function setupFilters() {
  $$('input[name="shopCategory"]').forEach((input) => {
    input.addEventListener("change", () => {
      const checked = $(
        'input[name="shopCategory"]:checked'
      );

      selectedCategory = checked ? checked.value : "";

      applyFilters();
    });
  });

  ["#shopMinPrice", "#shopMaxPrice"].forEach((selector) => {
    const input = $(selector);

    if (!input) {
      return;
    }

    input.addEventListener("change", applyFilters);
  });

  const stockCheckbox = $("#shopInStock");

  if (stockCheckbox) {
    stockCheckbox.addEventListener("change", () => {
      showInStockOnly = stockCheckbox.checked;

      applyFilters();
    });
  }

  const sortSelect = $("#shopSort");

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value;

      applyFilters();
    });
  }

  const clearButton = $("#shopClearFilters");

  if (clearButton) {
    clearButton.addEventListener("click", clearFilters);
  }

  const loadMoreButton = $("#shopLoadMore");

  if (loadMoreButton) {
    loadMoreButton.addEventListener(
      "click",
      loadMoreProducts
    );
  }

  const mobileFilterButton = $("#shopMobileFilterToggle");

  if (mobileFilterButton) {
    mobileFilterButton.addEventListener("click", () => {
      const sidebar = $(".shop-sidebar");

      if (!sidebar) {
        return;
      }

      sidebar.classList.toggle("is-open");

      mobileFilterButton.setAttribute(
        "aria-expanded",
        String(sidebar.classList.contains("is-open"))
      );
    });
  }
}

function clearFilters() {
  searchTerm = "";
  selectedCategory = "";
  showInStockOnly = false;
  favoritesOnly = false;

  const searchInput = $("#shopSearchInput");

  if (searchInput) {
    searchInput.value = "";
  }

  $$('input[name="shopCategory"]').forEach((input) => {
    input.checked = false;
  });

  const minPrice = $("#shopMinPrice");
  const maxPrice = $("#shopMaxPrice");
  const stockCheckbox = $("#shopInStock");

  if (minPrice) {
    minPrice.value = "";
  }

  if (maxPrice) {
    maxPrice.value = "";
  }

  if (stockCheckbox) {
    stockCheckbox.checked = false;
  }

  const heading = $("#shopIntroTitle");

  if (heading) {
    heading.textContent = "Discover Your Next Favourite";
  }

  applyFilters();
}

/* =========================================================
   HEADER BUTTONS
   ========================================================= */

function setupHeaderButtons() {
  const bagButton = $("#shopBagButton");

  if (bagButton) {
    bagButton.addEventListener("click", openCart);
  }

  const favoritesButton = $("#shopFavoritesButton");

  if (favoritesButton) {
    favoritesButton.addEventListener("click", () => {
      if (favoritesOnly) {
        showAllProducts();
      } else {
        showFavorites();
      }
    });
  }

  const mobileMenuButton = $("#shopMenuButton");

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", () => {
      const nav = $(".shop-header-nav");

      if (!nav) {
        return;
      }

      nav.classList.toggle("is-open");

      mobileMenuButton.setAttribute(
        "aria-expanded",
        String(nav.classList.contains("is-open"))
      );
    });
  }
}

/* =========================================================
   KEYBOARD SUPPORT
   ========================================================= */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeProductModal();
  }
});

/* =========================================================
   FOOTER YEAR
   ========================================================= */

function setupFooterYear() {
  const year = $("#shopYear");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
}

/* =========================================================
   INITIALIZE SHOP
   ========================================================= */

async function initializeShop() {
  updateHeaderCounts();

  setupSearchPanel();
  setupFilters();
  setupHeaderButtons();
  setupFooterYear();

  await loadProducts();

  renderCart();
}

initializeShop();