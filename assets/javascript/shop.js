/* =========================================================
   JIDDERHS HEAVEN
   Shop Catalogue
   File: assets/javascript/shop.js
========================================================= */

import { supabase } from "./supabase.js";

/* =========================================================
   1. CONFIGURATION
========================================================= */

const CART_KEY = "jiddamarh-cart";
const PRODUCTS_PER_PAGE = 12;

const $ = (selector) => document.querySelector(selector);

const elements = {
  grid: $("#shopProductGrid"),
  message: $("#shopMessage"),
  resultCount: $("#shopResultCount"),
  sort: $("#shopSort"),
  clearFilters: $("#shopClearFilters"),
  minPrice: $("#shopMinPrice"),
  maxPrice: $("#shopMaxPrice"),
  inStock: $("#shopInStock"),
  loadMore: $("#shopLoadMore"),
  bagButton: $("#shopBagButton"),
  bagCount: $("#shopBagCount"),
  searchToggle: $("#shopSearchToggle"),
  mobileFilterToggle: $("#shopMobileFilterToggle"),
  year: $("#shopYear")
};

let products = [];
let filteredProducts = [];
let visibleCount = PRODUCTS_PER_PAGE;
let searchInput = null;
let searchPanel = null;
let detailsModal = null;
let cartDrawer = null;

/* =========================================================
   2. LOCAL FALLBACK PRODUCTS

   These appear if the database cannot be reached.
   Supabase products will be used when available.
========================================================= */

const fallbackProducts = [
  {
    id: "local-abaya",
    name: "Abaya / Kimono",
    description: "A versatile wardrobe essential for an elegant look.",
    category: "apparel",
    price: 17500,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-palazzo",
    name: "Palazzo Pants",
    description: "Comfortable trousers for effortless everyday styling.",
    category: "apparel",
    price: 10000,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-beauty-mask",
    name: "Facial Beauty Mask",
    description: "An addition to your personal beauty routine.",
    category: "beauty",
    price: 300,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-mud-mask",
    name: "Deep Sea Mud Mask",
    description: "A beauty-care essential for your skincare collection.",
    category: "beauty",
    price: 1000,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-makeup",
    name: "Facial Make-up Set",
    description: "A make-up set for your beauty collection.",
    category: "beauty",
    price: 25000,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-handcream",
    name: "Hand Cream",
    description: "A handy addition to your personal-care essentials.",
    category: "beauty",
    price: 700,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-flask",
    name: "Vacuum Flask",
    description: "A practical everyday essential for your drinks.",
    category: "kitchen",
    price: 2000,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-cutlery",
    name: "Cutlery Set",
    description: "Useful dining essentials for everyday meals.",
    category: "kitchen",
    price: 17500,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-glassware",
    name: "Glassware Set",
    description: "Glassware for serving drinks at home.",
    category: "kitchen",
    price: 17500,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-sanitary",
    name: "Sanitary Set",
    description: "Everyday personal-care essentials.",
    category: "toiletries",
    price: 17500,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-hairdryer",
    name: "Hair Dryer",
    description: "A useful addition to your personal-care routine.",
    category: "beauty",
    price: 5000,
    image_url: "",
    stock: 10,
    is_active: true
  },
  {
    id: "local-storage",
    name: "Toiletries Travel Storage Bag",
    description: "Keep your travel toiletries organised.",
    category: "toiletries",
    price: 7000,
    image_url: "",
    stock: 10,
    is_active: true
  }
];

/* =========================================================
   3. GENERAL HELPERS
========================================================= */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
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

function formatNaira(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}

function normalizeCategory(category = "") {
  const value = String(category).toLowerCase().trim();

  const categories = {
    clothes: "apparel",
    clothing: "apparel",
    fashion: "apparel",
    cosmetics: "beauty",
    makeup: "beauty",
    skincare: "beauty",
    utensils: "kitchen",
    cookware: "kitchen",
    household: "kitchen",
    personalcare: "toiletries",
    "personal care": "toiletries"
  };

  return categories[value] || value || "toiletries";
}

function showMessage(message, type = "info") {
  if (!elements.message) return;

  elements.message.textContent = message;
  elements.message.dataset.type = type;
  elements.message.hidden = false;
}

function hideMessage() {
  if (!elements.message) return;

  elements.message.hidden = true;
}

function getCart() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]"
    );

    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error("Could not read shopping cart:", error);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateBagCount();
}

function updateBagCount() {
  const cart = getCart();

  const count = cart.reduce((total, item) => {
    return total + Math.max(0, Number(item.quantity) || 0);
  }, 0);

  if (elements.bagCount) {
    elements.bagCount.textContent = count;
  }

  const bottomCount = $("#jhBottomBagCount");

  if (bottomCount) {
    bottomCount.textContent = count;
  }
}

function findProduct(productId) {
  return products.find(
    (product) => String(product.id) === String(productId)
  );
}

function getCategoryName(category) {
  const names = {
    apparel: "Apparel",
    beauty: "Beauty",
    kitchen: "Kitchen",
    toiletries: "Toiletries"
  };

  return names[normalizeCategory(category)] || "Essentials";
}

/* =========================================================
   4. LOAD PRODUCTS FROM SUPABASE
========================================================= */

async function loadProducts() {
  showMessage("Loading our collection…");

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

    if (!Array.isArray(data)) {
      throw new Error("The product response was invalid.");
    }

    products = data.map((item) => ({
      ...item,
      id: String(item.id),
      price: Number(item.price) || 0,
      category: normalizeCategory(item.category),
      description: item.description || "",
      image_url: item.image_url || "",
      stock: item.stock == null ? null : Number(item.stock),
      is_active: item.is_active !== false
    }));

    console.log(
      "Jidderhs Heaven shop: products loaded from Supabase",
      products.length
    );

  } catch (error) {
    console.error(
      "Could not load Supabase products:",
      error
    );

    products = fallbackProducts.map((product) => ({
      ...product
    }));

    showMessage(
      "We couldn't connect to the live catalogue. Showing our available preview products.",
      "warning"
    );
  }

  applyFilters();

  if (products.length === 0) {
    showMessage(
      "No products are available yet. Please check back soon."
    );
  }
}

/* =========================================================
   5. SEARCH BOX
========================================================= */

function createSearchBox() {
  if (!elements.searchToggle) return;

  searchPanel = document.createElement("div");
  searchPanel.className = "shop-search-panel";
  searchPanel.hidden = true;

  searchPanel.innerHTML = `
    <label for="shopSearchInput">
      Search the collection
    </label>

    <input
      id="shopSearchInput"
      type="search"
      placeholder="Search products..."
      autocomplete="off"
    >

    <button type="button" id="shopSearchClose">
      Close
    </button>
  `;

  const header = document.querySelector(".shop-header");

  if (header) {
    header.insertAdjacentElement("afterend", searchPanel);
  }

  searchInput = $("#shopSearchInput");

  elements.searchToggle.addEventListener("click", () => {
    searchPanel.hidden = !searchPanel.hidden;

    if (!searchPanel.hidden) {
      searchInput.focus();
    }
  });

  $("#shopSearchClose").addEventListener("click", () => {
    searchPanel.hidden = true;
  });

  searchInput.addEventListener("input", () => {
    visibleCount = PRODUCTS_PER_PAGE;
    applyFilters();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchPanel.hidden = true;
      elements.searchToggle.focus();
    }
  });
}

/* =========================================================
   6. FILTERS AND SORTING
========================================================= */

function getSelectedCategory() {
  const selected = document.querySelector(
    'input[name="shopCategory"]:checked'
  );

  return selected ? selected.value : "all";
}

function applyFilters() {
  const category = getSelectedCategory();
  const minValue = elements.minPrice?.value;
  const maxValue = elements.maxPrice?.value;

  const minPrice =
    minValue !== "" && minValue != null
      ? Number(minValue)
      : null;

  const maxPrice =
    maxValue !== "" && maxValue != null
      ? Number(maxValue)
      : null;

  const inStockOnly = Boolean(elements.inStock?.checked);

  const searchTerm = (searchInput?.value || "")
    .trim()
    .toLowerCase();

  filteredProducts = products.filter((product) => {
    if (category !== "all" && product.category !== category) {
      return false;
    }

    if (minPrice !== null && product.price < minPrice) {
      return false;
    }

    if (maxPrice !== null && product.price > maxPrice) {
      return false;
    }

    if (
      inStockOnly &&
      product.stock !== null &&
      product.stock <= 0
    ) {
      return false;
    }

    if (inStockOnly && product.stock === null) {
      return false;
    }

    if (searchTerm) {
      const searchableText = [
        product.name,
        product.description,
        product.category
      ]
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });

  sortProducts();

  renderProducts();
}

function sortProducts() {
  const sortValue = elements.sort?.value || "featured";

  switch (sortValue) {
    case "newest":
      filteredProducts.sort((a, b) => {
        return (
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
        );
      });
      break;

    case "price-low":
      filteredProducts.sort((a, b) => a.price - b.price);
      break;

    case "price-high":
      filteredProducts.sort((a, b) => b.price - a.price);
      break;

    case "name":
      filteredProducts.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      break;

    default:
      // Featured keeps the original catalogue order.
      break;
  }
}

function clearFilters() {
  const allCategory = document.querySelector(
    'input[name="shopCategory"][value="all"]'
  );

  if (allCategory) {
    allCategory.checked = true;
  }

  if (elements.minPrice) elements.minPrice.value = "";
  if (elements.maxPrice) elements.maxPrice.value = "";
  if (elements.inStock) elements.inStock.checked = false;

  if (elements.sort) elements.sort.value = "featured";
  if (searchInput) searchInput.value = "";

  visibleCount = PRODUCTS_PER_PAGE;

  applyFilters();
}

/* =========================================================
   7. PRODUCT CARDS
========================================================= */

function createProductCard(product) {
  const card = document.createElement("article");

  card.className = "shop-product-card";

  const outOfStock =
    product.stock !== null && product.stock <= 0;

  const image = product.image_url
    ? `
      <img
        src="${escapeHTML(product.image_url)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
      >
    `
    : `
      <div class="shop-image-placeholder">
        <span>JH</span>
        <small>${escapeHTML(getCategoryName(product.category))}</small>
      </div>
    `;

  card.innerHTML = `
    <div class="shop-product-image-wrap">
      <button
        class="shop-product-details"
        type="button"
        data-action="details"
        aria-label="View details for ${escapeHTML(product.name)}"
      >
        ${image}
      </button>

      <span class="shop-product-category">
        ${escapeHTML(getCategoryName(product.category))}
      </span>

      ${
        outOfStock
          ? '<span class="shop-stock-label">Out of stock</span>'
          : ""
      }
    </div>

    <div class="shop-product-info">
      <button
        class="shop-product-name"
        type="button"
        data-action="details"
      >
        ${escapeHTML(product.name)}
      </button>

      <p class="shop-product-price">
        ${formatNaira(product.price)}
      </p>

      <div class="shop-product-actions">
        <button
          type="button"
          data-action="details"
          class="shop-view-details"
        >
          View details
        </button>

        <button
          type="button"
          data-action="add"
          class="shop-add-button"
          ${outOfStock ? "disabled" : ""}
        >
          ${outOfStock ? "Unavailable" : "Add to bag"}
        </button>
      </div>
    </div>
  `;

  card.querySelectorAll('[data-action="details"]').forEach(
    (button) => {
      button.addEventListener("click", () => {
        openProductDetails(product.id);
      });
    }
  );

  const addButton = card.querySelector('[data-action="add"]');

  addButton.addEventListener("click", () => {
    addToCart(product.id);
  });

  const productImage = card.querySelector("img");

  if (productImage) {
    productImage.addEventListener("error", () => {
      const placeholder = document.createElement("div");

      placeholder.className = "shop-image-placeholder";
      placeholder.innerHTML = `
        <span>JH</span>
        <small>${escapeHTML(getCategoryName(product.category))}</small>
      `;

      productImage.replaceWith(placeholder);
    });
  }

  return card;
}

function renderProducts() {
  if (!elements.grid) return;

  elements.grid.innerHTML = "";

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  if (elements.resultCount) {
    const count = filteredProducts.length;

    elements.resultCount.textContent =
      `${count} ${count === 1 ? "product" : "products"} found`;
  }

  if (visibleProducts.length === 0) {
    showMessage(
      "No products match your filters. Try changing your search or price range."
    );
  } else {
    hideMessage();

    visibleProducts.forEach((product) => {
      elements.grid.appendChild(createProductCard(product));
    });
  }

  if (elements.loadMore) {
    elements.loadMore.hidden =
      visibleCount >= filteredProducts.length;
  }
}

/* =========================================================
   8. PRODUCT DETAILS MODAL
========================================================= */

function createDetailsModal() {
  detailsModal = document.createElement("div");

  detailsModal.className = "shop-details-overlay";
  detailsModal.hidden = true;

  detailsModal.innerHTML = `
    <section
      class="shop-details-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopDetailsTitle"
    >
      <button
        type="button"
        class="shop-details-close"
        aria-label="Close product details"
      >
        &times;
      </button>

      <div id="shopDetailsContent"></div>
    </section>
  `;

  document.body.appendChild(detailsModal);

  detailsModal
    .querySelector(".shop-details-close")
    .addEventListener("click", closeProductDetails);

  detailsModal.addEventListener("click", (event) => {
    if (event.target === detailsModal) {
      closeProductDetails();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !detailsModal.hidden
    ) {
      closeProductDetails();
    }
  });
}

function openProductDetails(productId) {
  const product = findProduct(productId);

  if (!product || !detailsModal) return;

  const outOfStock =
    product.stock !== null && product.stock <= 0;

  const image = product.image_url
    ? `
      <img
        src="${escapeHTML(product.image_url)}"
        alt="${escapeHTML(product.name)}"
      >
    `
    : `
      <div class="shop-image-placeholder">
        <span>JH</span>
        <small>${escapeHTML(getCategoryName(product.category))}</small>
      </div>
    `;

  const content = $("#shopDetailsContent");

  content.innerHTML = `
    <div class="shop-details-layout">

      <div class="shop-details-image">
        ${image}
      </div>

      <div class="shop-details-info">

        <p class="shop-eyebrow">
          ${escapeHTML(getCategoryName(product.category))}
        </p>

        <h2 id="shopDetailsTitle">
          ${escapeHTML(product.name)}
        </h2>

        <p class="shop-details-price">
          ${formatNaira(product.price)}
        </p>

        <p class="shop-details-description">
          ${
            escapeHTML(
              product.description ||
              "Discover this item from the Jidderhs Heaven collection."
            )
          }
        </p>

        <p class="shop-details-stock">
          ${
            outOfStock
              ? "Currently out of stock"
              : product.stock === null
                ? "Contact us to confirm availability"
                : `${product.stock} available`
          }
        </p>

        <button
          type="button"
          id="shopDetailsAdd"
          class="shop-add-button"
          ${outOfStock ? "disabled" : ""}
        >
          ${outOfStock ? "Unavailable" : "Add to bag"}
        </button>

      </div>
    </div>
  `;

  const addButton = $("#shopDetailsAdd");

  addButton.addEventListener("click", () => {
    if (addToCart(product.id)) {
      closeProductDetails();
      openCartDrawer();
    }
  });

  detailsModal.hidden = false;
  document.body.classList.add("shop-modal-open");

  detailsModal
    .querySelector(".shop-details-close")
    .focus();
}

function closeProductDetails() {
  if (!detailsModal) return;

  detailsModal.hidden = true;
  document.body.classList.remove("shop-modal-open");
}

/* =========================================================
   9. ADD PRODUCTS TO THE EXISTING CART
========================================================= */

function addToCart(productId) {
  const product = findProduct(productId);

  if (!product) {
    alert("This product could not be found.");
    return false;
  }

  if (product.stock !== null && product.stock <= 0) {
    alert("Sorry, this product is out of stock.");
    return false;
  }

  const cart = getCart();

  const existingItem = cart.find(
    (item) => String(item.id) === String(product.id)
  );

  const currentQuantity = existingItem
    ? Number(existingItem.quantity) || 0
    : 0;

  if (
    product.stock !== null &&
    currentQuantity >= product.stock
  ) {
    alert("You have reached the available stock for this product.");
    return false;
  }

  if (existingItem) {
    existingItem.quantity = currentQuantity + 1;
    existingItem.price = product.price;
    existingItem.name = product.name;
    existingItem.image = product.image_url || existingItem.image || "";
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url || "",
      quantity: 1
    });
  }

  saveCart(cart);

  console.log("Product added to bag:", product.name);

  return true;
}

/* =========================================================
   10. CART DRAWER
========================================================= */

function createCartDrawer() {
  cartDrawer = document.createElement("div");

  cartDrawer.className = "shop-cart-overlay";
  cartDrawer.hidden = true;

  cartDrawer.innerHTML = `
    <section
      class="shop-cart-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopCartTitle"
    >
      <div class="shop-cart-heading">
        <h2 id="shopCartTitle">Your bag</h2>

        <button
          type="button"
          id="shopCartClose"
          aria-label="Close bag"
        >
          &times;
        </button>
      </div>

      <div id="shopCartItems"></div>

      <div class="shop-cart-footer">
        <p>
          Subtotal:
          <strong id="shopCartSubtotal">₦0</strong>
        </p>

        <a href="./checkout.html" id="shopCheckoutLink">
          Continue to checkout
        </a>

        <a href="./index.html" class="shop-continue-shopping">
          Continue shopping
        </a>
      </div>
    </section>
  `;

  document.body.appendChild(cartDrawer);

  $("#shopCartClose").addEventListener("click", closeCartDrawer);

  cartDrawer.addEventListener("click", (event) => {
    if (event.target === cartDrawer) {
      closeCartDrawer();
    }
  });

  $("#shopCheckoutLink").addEventListener("click", (event) => {
    if (getCart().length === 0) {
      event.preventDefault();
      alert("Your bag is empty. Please add a product first.");
    }
  });

  cartDrawer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");

    if (!button) return;

    const productId = button.dataset.id;
    const action = button.dataset.cartAction;

    changeCartQuantity(productId, action);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !cartDrawer.hidden
    ) {
      closeCartDrawer();
    }
  });
}

function renderCartDrawer() {
  if (!cartDrawer) return;

  const cart = getCart();
  const itemsContainer = $("#shopCartItems");

  itemsContainer.innerHTML = "";

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <p class="shop-cart-empty">
        Your bag is empty. Discover something you love.
      </p>
    `;
  }

  let subtotal = 0;

  cart.forEach((item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const price = Number(item.price) || 0;

    subtotal += price * quantity;

    const row = document.createElement("div");

    row.className = "shop-cart-item";

    row.innerHTML = `
      <div class="shop-cart-item-info">
        <h3>${escapeHTML(item.name)}</h3>

        <p>${formatNaira(price)}</p>

        <div class="shop-cart-quantity">
          <button
            type="button"
            data-cart-action="minus"
            data-id="${escapeHTML(item.id)}"
            aria-label="Decrease quantity"
          >−</button>

          <span>${quantity}</span>

          <button
            type="button"
            data-cart-action="plus"
            data-id="${escapeHTML(item.id)}"
            aria-label="Increase quantity"
          >+</button>

          <button
            type="button"
            data-cart-action="remove"
            data-id="${escapeHTML(item.id)}"
          >Remove</button>
        </div>
      </div>

      <strong>${formatNaira(price * quantity)}</strong>
    `;

    itemsContainer.appendChild(row);
  });

  $("#shopCartSubtotal").textContent = formatNaira(subtotal);
}

function changeCartQuantity(productId, action) {
  const cart = getCart();

  const index = cart.findIndex(
    (item) => String(item.id) === String(productId)
  );

  if (index === -1) return;

  const item = cart[index];

  if (action === "remove") {
    cart.splice(index, 1);
  } else if (action === "minus") {
    item.quantity = (Number(item.quantity) || 1) - 1;

    if (item.quantity <= 0) {
      cart.splice(index, 1);
    }
  } else if (action === "plus") {
    const product = findProduct(productId);

    if (
      product &&
      product.stock !== null &&
      (Number(item.quantity) || 0) >= product.stock
    ) {
      alert("You have reached the available stock for this product.");
      return;
    }

    item.quantity = (Number(item.quantity) || 0) + 1;
  }

  saveCart(cart);
  renderCartDrawer();
}

function openCartDrawer() {
  if (!cartDrawer) return;

  renderCartDrawer();

  cartDrawer.hidden = false;
  document.body.classList.add("shop-modal-open");

  $("#shopCartClose").focus();
}

function closeCartDrawer() {
  if (!cartDrawer) return;

  cartDrawer.hidden = true;
  document.body.classList.remove("shop-modal-open");
}

/* =========================================================
   11. MOBILE FILTERS
========================================================= */

function setupMobileFilters() {
  if (!elements.mobileFilterToggle) return;

  const sidebar = document.querySelector(".shop-sidebar");

  if (!sidebar) return;

  elements.mobileFilterToggle.addEventListener("click", () => {
    const expanded =
      elements.mobileFilterToggle.getAttribute("aria-expanded") === "true";

    elements.mobileFilterToggle.setAttribute(
      "aria-expanded",
      String(!expanded)
    );

    sidebar.classList.toggle("shop-sidebar-open", !expanded);
  });
}

/* =========================================================
   12. EVENT LISTENERS
========================================================= */

function setupEventListeners() {
  document
    .querySelectorAll('input[name="shopCategory"]')
    .forEach((input) => {
      input.addEventListener("change", () => {
        visibleCount = PRODUCTS_PER_PAGE;
        applyFilters();
      });
    });

  elements.minPrice?.addEventListener("input", () => {
    visibleCount = PRODUCTS_PER_PAGE;
    applyFilters();
  });

  elements.maxPrice?.addEventListener("input", () => {
    visibleCount = PRODUCTS_PER_PAGE;
    applyFilters();
  });

  elements.inStock?.addEventListener("change", () => {
    visibleCount = PRODUCTS_PER_PAGE;
    applyFilters();
  });

  elements.sort?.addEventListener("change", () => {
    applyFilters();
  });

  elements.clearFilters?.addEventListener("click", clearFilters);

  elements.loadMore?.addEventListener("click", () => {
    visibleCount += PRODUCTS_PER_PAGE;
    renderProducts();
  });

  elements.bagButton?.addEventListener("click", openCartDrawer);

  setupMobileFilters();
}

/* =========================================================
   13. INITIALIZE SHOP PAGE
========================================================= */

async function initializeShop() {
  if (elements.year) {
    elements.year.textContent = new Date().getFullYear();
  }

  createSearchBox();
  createDetailsModal();
  createCartDrawer();

  setupEventListeners();
  updateBagCount();

  await loadProducts();
}

initializeShop();