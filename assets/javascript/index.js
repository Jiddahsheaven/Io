import { supabase, testDatabaseConnection } from './supabase.js';

testDatabaseConnection();

// @ts-nocheck
/* ==========================================================
   ALL BY JIDDAMARH
   Front-end interactions
   ========================================================== */

let products = [
  {
    id: 1,
    name: "Abaya/kimono",
    category: "apparel",
    price: 17500,
    tag: "New",
    description: "Elevate your style with our elegant Abayas and Kimonos, perfect for modest fashion and effortless sophistication.",
    image: "assets/images/abayas.jpg"
  },

  {
    id: 2,
    name: "Palazzo pants",
    category: "apparel",
    price: 10000,
    tag: "Hot pick",
    description: "Enjoy effortless style and comfort with our Palazzo Pants, perfect for chic everyday looks and elegant outings.",
    image: "assets/images/palazzo.jpg"
  },

  {
    id: 3,
    name: "Facial beauty mask",
    category: "beauty",
    price: 300,
    tag: "Bestseller",
    description: "Refresh and nourish your skin with our Facial Beauty Mask for a radiant, healthy-looking glow.",
    image: "assets/images/facialmask.jpg"
  },

  {
    id: 4,
    name: "Deep sea mud mask",
    category: "beauty",
    price: 1000,
    tag: "Bestseller",
    description: "Purify and refresh your skin with our Mud Beauty Mask for a good-looking glow.",
    image: "assets/images/mudmask.jpg"
  },

  {
    id: 5,
    name: "Facial make-up set",
    category: "beauty",
    price: 25000,
    tag: "New",
    description: "Create stunning looks with our Facial Makeup Set, perfect for everyday beauty and special occasions.",
    image: "assets/images/makeupset.jpg"
  },

  {
    id: 6,
    name: "Handcream",
    category: "beauty",
    price: 700,
    tag: "new",
    description: "Keep your hands soft and moisturized with our Hand Cream for smooth, nourished skin every day.",
    image: "assets/images/handcream.jpg"
  },

  {
    id: 7,
    name: "Vacuum flask",
    category: "kitchen",
    price: 2000,
    tag: "New",
    description: "Keep your drinks at the perfect temperature with our Flask, ideal for everyday use, travel, and busy days.",
    image: "assets/images/flask.jpg"
  },

    {
    id: 8,
    name: "Cutlery set",
    category: "kitchen",
    price: 17500,
    tag: "Edit",
    description: "A compact, considered kit made for weekends and getaways.",
    image: "assets/images/cutleryset.jpg"
    },
  
  {
    id: 9,
    name: "Glassware set",
    category: "kitchen",
    price: 17500,
    tag: "hot",
    description: "A compact, considered kit made for weekends and getaways.",
    image: "assets/images/glasswares.jpg"
    },
  
  {
    id: 10,
    name: "Sanitary Set",
    category: "toiletries",
    price: 17500,
    tag: "bestseller",
    description: "Stay prepared and organized with our Sanitary Sets, designed for comfort and convenience during your period.",
    image: "assets/images/sanitary.jpg"
  },

  {
  id: 11,
    name: "Hair dryer",
    category: "toiletries",
    price: 5000,
    tag: "hot pick",
    description: "Style your hair with ease using our Hair Dryer, perfect for quick drying and effortless everyday styling.",
    image: "assets/images/dryer.jpg"
    },
  
  {
    id: 12,
    name: "Toiletries travel storage bag",
    category: "toiletries",
    price: 7000,
    tag: "new",
    description: "Keep your essentials organized with our Toiletries Storage Bag, perfect for travel and everyday convenience.",
    image: "assets/images/storagebag.jpg"
  }
];

async function testSupabaseProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Could not load products:', error.message);
        return;
    }

    console.log('Products from Supabase:', data);
}

testSupabaseProducts();

/* ==========================================================
   CATEGORY NAMES
   ========================================================== */

const categoryLabels = {
  apparel: "Apparel",
  beauty: "Beauty",
  kitchen: "Kitchen",
  toiletries: "Toiletries"
};


/* ==========================================================
   GLOBAL VARIABLES
   ========================================================== */

let activeFilter = "all";
let cart = (() => {
  try {
    const savedCart = JSON.parse(
      localStorage.getItem("jiddamarh-cart") || "[]"
    );

    return Array.isArray(savedCart) ? savedCart : [];
  } catch (error) {
    return [];
  }
})();


/* ==========================================================
   SHORT SELECTORS
   ========================================================== */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


/* ==========================================================
   MAIN ELEMENTS
   ========================================================== */

const featuredProducts = $("#featuredProducts");

const allProducts = $("#allProducts");

const bagCount = $("#bagCount");

const cartDrawer = $("#cartDrawer");

const cartOverlay = $("#cartOverlay");

const cartItems = $("#cartItems");

const cartSubtotal = $("#cartSubtotal");

const toast = $("#toast");

const searchPanel = $("#searchPanel");

const searchInput = $("#searchInput");


/* ==========================================================
   FORMAT NIGERIAN NAIRA
   ========================================================== */

function formatNaira(value) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function productMatchesSearch(product, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchableText = normalizeSearchText([
    product.name,
    product.description,
    product.category,
    categoryLabels[product.category],
    product.tag
  ].join(" "));

  const synonyms = {
    makeup: "beauty",
    cosmetics: "beauty",
    skincare: "toiletries",
    face: "toiletries",
    clothes: "apparel",
    clothing: "apparel",
    utensils: "kitchen",
    cookware: "kitchen",
    bodymist: "body mist"
  };
  const expandedQuery = synonyms[normalizedQuery] || normalizedQuery;
  return searchableText.includes(expandedQuery);
}


/* ==========================================================
   CREATE PRODUCT CARD
   ========================================================== */

function createProductCard(product, dark = false) {

  const article = document.createElement("article");

  article.className = "product-card";

  article.dataset.category = product.category;

  article.dataset.name = product.name.toLowerCase();


  article.innerHTML = `

    <div class="product-media image-slot">
      <img
        class="slot-image"
        src="${product.image}"
        alt="${product.name}"
        loading="lazy"
        decoding="async"
      >

      <span class="product-tag">${product.tag}</span>

    </div>


    <div class="product-info">

      <div class="product-meta">

        <span>
          ${categoryLabels[product.category]}
        </span>

        <span>
           JIDDAHS HEAVEN
        </span>

      </div>


      <h3 class="product-name">
        ${product.name}
      </h3>


      <p class="product-desc">
        ${product.description}
      </p>


      <div class="product-bottom">

        <span class="product-price">
          ${formatNaira(product.price)}
        </span>


        <button
          class="add-to-bag"
          type="button"
          data-add-id="${product.id}"
        >
          Add to bag
        </button>

      </div>

    </div>

  `;


  if (dark) {
    article.classList.add("dark-product");
  }


  return article;
}


/* ==========================================================
   RENDER FEATURED PRODUCTS
   ========================================================== */

function renderFeatured() {

  featuredProducts.innerHTML = "";


  products
    .slice(0, 4)
    .forEach((product) => {

      featuredProducts.appendChild(
        createProductCard(product, true)
      );

    });

}


/* ==========================================================
   RENDER ALL PRODUCTS
   ========================================================== */

function renderProducts(
  filter = activeFilter,
  query = ""
) {

  activeFilter = filter;


  const visible = products.filter((product) => {
    const matchesFilter = filter === "all" || product.category === filter;
    return matchesFilter && productMatchesSearch(product, query);
  });


  allProducts.innerHTML = "";


  if (!visible.length) {

    allProducts.innerHTML = `

      <div class="empty-state">

        <h3>
          No pieces found.
        </h3>

        <p>
          Try another search or switch categories.
        </p>

      </div>

    `;

    return;
  }


  visible.forEach((product) => {

    allProducts.appendChild(
      createProductCard(product)
    );

  });

}


/* ==========================================================
   UPDATE FILTER BUTTONS
   ========================================================== */

function syncFilterUI() {

  $$(".filter-button").forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.filter === activeFilter
    );

  });

}


/* ==========================================================
   CHANGE CATEGORY
   ========================================================== */

function setFilter(
  filter,
  scroll = false
) {

  renderProducts(filter, "");

  syncFilterUI();


  if (scroll) {

    const collection =
      $("#productCollection");

    if (collection) {

      collection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    }

  }

}


/* ==========================================================
   ADD PRODUCT TO CART
   ========================================================== */

function addToCart(productId) {
  const product = products.find(
    item => String(item.id) === String(productId)
  );

  if (!product) {
    showToast("Product not found.");
    return;
  }

  if (Number(product.stock) <= 0) {
    showToast("Sorry, this product is out of stock.");
    return;
  }

  const existingItem = cart.find(
    item => String(item.id) === String(productId)
  );

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  updateCartUI();
  showToast(`${product.name} added to your bag.`);
}


/* ==========================================================
   REMOVE PRODUCT FROM CART
   ========================================================== */

function removeFromCart(productId) {
  cart = cart.filter(
    item => String(item.id) !== String(productId)
  );

  updateCartUI();
}


/* ==========================================================
   UPDATE CART
   ========================================================== */

function updateCartUI() {
  // Save cart so it survives a page refresh.
  try {
    localStorage.setItem(
      "jiddamarh-cart",
      JSON.stringify(cart)
    );
  } catch (error) {
    console.warn("Could not save cart:", error);
  }

  // Update total item count.
  const count = cart.reduce(
    (total, item) => total + item.qty,
    0
  );

  // Calculate subtotal.
  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.qty,
    0
  );

  bagCount.textContent = count;
  cartSubtotal.textContent = formatNaira(subtotal);

  // Empty cart message.
  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        Your bag is currently empty.
        <br><br>
        Explore the collection
        and add something you love.
      </div>
    `;
    return;
  }

  // Render cart items and quantity controls.
  cartItems.innerHTML = cart.map((item) => {
    const stock = Number(item.stock);
    const hasStockLimit = Number.isFinite(stock) && stock >= 0;
    const canIncrease =
      !hasStockLimit || item.qty < stock;

    return `
      <div class="cart-item">

        <img
          class="cart-item-thumb"
          src="${item.image}"
          alt="${item.name}"
          loading="lazy"
        >

        <div class="cart-item-details">

          <h4>${item.name}</h4>

          <p>
            ${categoryLabels[item.category] || item.category || "Collection"}
          </p>

          <div class="quantity-controls">

            <button
              type="button"
              class="quantity-btn"
              data-qty-id="${item.id}"
              data-qty-change="-1"
              aria-label="Decrease ${item.name} quantity"
              ${item.qty <= 1 ? "disabled" : ""}
            >−</button>

            <span class="quantity-value">
              ${item.qty}
            </span>

            <button
              type="button"
              class="quantity-btn"
              data-qty-id="${item.id}"
              data-qty-change="1"
              aria-label="Increase ${item.name} quantity"
              ${!canIncrease ? "disabled" : ""}
            >+</button>

          </div>

        </div>

        <div>

          <div class="cart-item-price">
            ${formatNaira(item.price * item.qty)}
          </div>

          <button
            class="add-to-bag"
            type="button"
            data-remove-id="${item.id}"
            style="margin-top:7px;"
          >
            Remove
          </button>

        </div>

      </div>
    `;
  }).join("");
}


/* ==========================================================
   OPEN CART
   ========================================================== */

function openCart() {

  cartDrawer.classList.add("open");

  cartOverlay.classList.add("open");

  document.body.classList.add(
    "no-scroll"
  );

}


/* ==========================================================
   CLOSE CART
   ========================================================== */

function closeCart() {

  cartDrawer.classList.remove("open");

  cartOverlay.classList.remove("open");

  document.body.classList.remove(
    "no-scroll"
  );

}


/* ==========================================================
   TOAST MESSAGE
   ========================================================== */

let toastTimer;


function showToast(message) {

  clearTimeout(toastTimer);


  toast.textContent = message;


  toast.classList.add("show");


  toastTimer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2400);

}


/* ==========================================================
   ADD / REMOVE CART BUTTONS
   ========================================================== */

document.addEventListener(
  "click",
  (event) => {

    const addButton =
      event.target.closest(
        "[data-add-id]"
      );


    if (addButton) {

      addToCart(
        addButton.dataset.addId
      );

      return;
    }

    // Handle quantity buttons
const quantityButton = event.target.closest("[data-qty-id]");

if (quantityButton) {
  const productId = quantityButton.dataset.qtyId;
  const change = Number(quantityButton.dataset.qtyChange);

  const item = cart.find(
    product => String(product.id) === String(productId)
  );

  if (!item) return;

  const newQuantity = item.qty + change;

  if (newQuantity < 1) return;

  const stock = Number(item.stock);

  if (
    Number.isFinite(stock) &&
    stock >= 0 &&
    newQuantity > stock
  ) {
    showToast("You cannot exceed the available stock.");
    return;
  }

  item.qty = newQuantity;

  updateCartUI();
  return;
}

    const removeButton =
      event.target.closest (
        "[data-remove-id]"
      );


    if (removeButton) {

      removeFromCart(
        removeButton.dataset.removeId
      );

      return;
    }

  }
);


/* ==========================================================
   CATEGORY CARD LINKS
   ========================================================== */

document.addEventListener(
  "click",
  (event) => {

    const categoryLink =
      event.target.closest(
        "[data-category-link]"
      );


    if (!categoryLink) return;


    const filter =
      categoryLink.dataset.categoryLink;


    setFilter(filter, true);

  }
);


/* ==========================================================
   FOOTER CATEGORY LINKS
   ========================================================== */

document.addEventListener(
  "click",
  (event) => {

    const footerFilter =
      event.target.closest(
        "[data-footer-filter]"
      );


    if (!footerFilter) return;


    const filter =
      footerFilter.dataset.footerFilter;


    setFilter(filter, true);

  }
);


/* ==========================================================
   EDITORIAL CATEGORY BUTTONS
   ========================================================== */

document.addEventListener(
  "click",
  (event) => {

    const jumpButton =
      event.target.closest(
        "[data-jump-filter]"
      );


    if (!jumpButton) return;


    const filter =
      jumpButton.dataset.jumpFilter;


    setFilter(filter, true);

  }
);


/* ==========================================================
   PRODUCT FILTER BUTTONS
   ========================================================== */

const filters =
  $("#filters");


if (filters) {

  filters.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          ".filter-button"
        );


      if (!button) return;


      setFilter(
        button.dataset.filter
      );

    }
  );

}


/* ==========================================================
   SEARCH — LIVE FILTERING + MOBILE-FRIENDLY RESULTS
   ========================================================== */
const searchToggle = $("#searchToggle");
const searchClose = $("#searchClose");
const searchHint = $("#searchHint");

function closeSearch({ clear = true } = {}) {
  searchPanel.classList.remove("open");
  searchToggle.setAttribute("aria-expanded", "false");
  if (clear) {
    searchInput.value = "";
    renderProducts("all", "");
    syncFilterUI();
    if (searchHint) searchHint.textContent = "Start typing to filter products.";
  }
}

searchToggle.addEventListener("click", () => {
  const isOpen = searchPanel.classList.toggle("open");
  searchToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    window.setTimeout(() => searchInput.focus(), 80);
  }
});

searchClose.addEventListener("click", () => closeSearch());

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  // Search the full catalogue even if a category filter was previously active.
  renderProducts("all", query);
  syncFilterUI();

  if (!searchHint) return;
  if (!query) {
    searchHint.textContent = "Start typing to filter products.";
    return;
  }

  const count = products.filter((product) => productMatchesSearch(product, query)).length;
  searchHint.textContent = count
    ? `${count} matching ${count === 1 ? "product" : "products"}. Press Enter to view results.`
    : `No matches for “${query}”. Try a category such as apparel, beauty, kitchen or toiletries.`;
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("#productCollection").scrollIntoView({ behavior: "smooth", block: "start" });
    closeSearch({ clear: false });
  }
});

/* ==========================================================
   MOBILE MENU
   ========================================================== */

$("#menuToggle").addEventListener(
  "click",
  () => {

    const mobileNav =
      $("#mobileNav");


    const open =
      mobileNav.classList.toggle(
        "open"
      );


    $("#menuToggle").setAttribute(
      "aria-expanded",
      String(open)
    );

  }
);


/* ==========================================================
   CLOSE MOBILE MENU WHEN LINK CLICKED
   ========================================================== */

$("#mobileNav").addEventListener(
  "click",
  (event) => {

    if (
      event.target.matches("a")
    ) {

      $("#mobileNav").classList.remove(
        "open"
      );


      $("#menuToggle").setAttribute(
        "aria-expanded",
        "false"
      );

    }

  }
);


/* ==========================================================
   CART BUTTON
   ========================================================== */

$("#bagToggle").addEventListener(
  "click",
  openCart
);


/* ==========================================================
   CART CLOSE
   ========================================================== */

$("#cartClose").addEventListener(
  "click",
  closeCart
);


/* ==========================================================
   CLICK CART OVERLAY TO CLOSE
   ========================================================== */

cartOverlay.addEventListener(
  "click",
  closeCart
);


/* ==========================================================
   ESCAPE KEY
   ========================================================== */

document.addEventListener(
  "keydown",
  (event) => {

    if (event.key === "Escape") {

      closeCart();

      closeSearch({ clear: false });

    }

  }
);


/* ==========================================================
   NEWSLETTER
   ========================================================== */

$("#newsletterForm").addEventListener(
  "submit",
  (event) => {

    event.preventDefault();


    const email =
      $("#emailInput")
        .value
        .trim();


    if (!email) return;


    $("#newsletterMessage").textContent =
      `Email sign-up is not connected yet, so ${email} has not been submitted.`;


    event.currentTarget.classList.add(
      "success"
    );


    event.currentTarget.reset();

  }
);


/* ==========================================================
   CHECKOUT BUTTON
   ========================================================== */

/* ========================================
   JIDDAMARH CHECKOUT PAGE
======================================== */

$("#checkoutButton").addEventListener("click", () => {
  if (!cart.length) {
    showToast("Your bag is empty.");
    return;
  }

  window.location.href = "checkout.html";
});

*/ ==========================================================
   CURRENT YEAR
   ========================================================== */

$("#year").textContent =
  new Date().getFullYear();



/* ==========================================================
   SCROLL-REVEAL ANIMATIONS (works on touch screens too)
   ========================================================== */
function setupScrollReveal() {
  const revealTargets = document.querySelectorAll(
    ".section-heading, .category-card, .editorial-copy, .editorial-media, .statement-inner, .service-card, .newsletter-inner, .product-card"
  );
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  revealTargets.forEach((element, index) => {
    element.classList.add("reveal-on-scroll");
    if (element.matches(".category-card, .service-card, .product-card")) {
      element.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);
    }
  });
  document.documentElement.classList.add("reveal-ready");

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

  revealTargets.forEach((element) => observer.observe(element));
}

/* ==========================================================
   INITIAL WEBSITE LOAD
   ========================================================== */

renderFeatured();

renderProducts("all");

updateCartUI();
setupScrollReveal();

// ========================================
// NORMALIZE PRODUCT CATEGORIES
// ========================================
function normalizeCategory(category) {
  const value = String(category || "").trim().toLowerCase();

  const categoryMap = {
    // 👗 APPAREL
    "apparel": "apparel",
    "fashion": "apparel",
    "clothing": "apparel",
    "women's clothing": "apparel",
    "men's clothing": "apparel",
    "menswear": "apparel",
    "dresses": "apparel",
    "gowns": "apparel",
    "abayas": "apparel",
    "abaya": "apparel",
    "kimono": "apparel",
    "hijabs": "apparel",
    "tops": "apparel",
    "shirts": "apparel",
    "trousers": "apparel",
    "skirts": "apparel",
    "jeans": "apparel",
    "shorts": "apparel",
    "jackets": "apparel",
    "coats": "apparel",
    "underwear": "apparel",
    "lingerie": "apparel",
    "sleepwear": "apparel",
    "activewear": "apparel",
    "sportswear": "apparel",

    // 💄 BEAUTY
    "beauty": "beauty",
    "beauty products": "beauty",
    "skincare": "beauty",
    "skin care": "beauty",
    "makeup": "beauty",
    "cosmetics": "beauty",
    "perfume": "beauty",
    "perfumes": "beauty",
    "fragrance": "beauty",
    "fragrances": "beauty",
    "body care": "beauty",
    "body lotion": "beauty",
    "moisturizer": "beauty",
    "moisturizers": "beauty",
    "face cream": "beauty",
    "cleansers": "beauty",
    "serums": "beauty",
    "sunscreen": "beauty",
    "lipstick": "beauty",
    "lip gloss": "beauty",
    "foundation": "beauty",
    "powder": "beauty",
    "mascara": "beauty",
    "eyeliner": "beauty",
    "hair care": "beauty",
    "shampoo": "beauty",
    "conditioner": "beauty",
    "wigs": "beauty",
    "hair extensions": "beauty",
    "nail polish": "beauty",
    "nails": "beauty",

    // 🍳 KITCHEN
    "kitchen": "kitchen",
    "kitchenware": "kitchen",
    "cookware": "kitchen",
    "utensils": "kitchen",
    "kitchen utensils": "kitchen",
    "pots": "kitchen",
    "pans": "kitchen",
    "frying pans": "kitchen",
    "cooking pots": "kitchen",
    "plates": "kitchen",
    "dishes": "kitchen",
    "bowls": "kitchen",
    "cups": "kitchen",
    "mugs": "kitchen",
    "cutlery": "kitchen",
    "cutlery sets": "kitchen",
    "knives": "kitchen",
    "chopping boards": "kitchen",
    "storage containers": "kitchen",
    "food containers": "kitchen",
    "water bottles": "kitchen",
    "flasks": "kitchen",
    "kettles": "kitchen",
    "blenders": "kitchen",
    "kitchen appliances": "kitchen",
    "bakeware": "kitchen",
    "baking tools": "kitchen",
    "dish racks": "kitchen",
    "dish drainers": "kitchen",

    // 🧴 TOILETRIES
    "toiletries": "toiletries",
    "personal care": "toiletries",
    "bathroom essentials": "toiletries",
    "bath products": "toiletries",
    "soap": "toiletries",
    "body wash": "toiletries",
    "shower gel": "toiletries",
    "toothpaste": "toiletries",
    "toothbrushes": "toiletries",
    "mouthwash": "toiletries",
    "deodorant": "toiletries",
    "deodorants": "toiletries",
    "tissues": "toiletries",
    "toilet paper": "toiletries",
    "sanitary pads": "toiletries",
    "tampons": "toiletries",
    "cotton buds": "toiletries",
    "cotton wool": "toiletries",
    "hand wash": "toiletries",
    "hand sanitizer": "toiletries",
    "shaving products": "toiletries",
    "razors": "toiletries",
    "loofahs": "toiletries",
    "bath towels": "toiletries",
    "face towels": "toiletries",
    "bath sponges": "toiletries"
  };

  return categoryMap[value] || value;
}

async function loadSupabaseProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Supabase product loading failed:", error.message);
    showToast("Could not load online products.");
    return;
  }

  if (!data) return;

  // Convert database records into your website's product format.
  const databaseProducts = data.map(item => ({
  id: `supabase-${item.id}`,
  name: item.name || "Unnamed product",
  category: normalizeCategory(item.category),
  price: Number(item.price) || 0,
  tag: "New",
  description: item.description || "",
  image: item.image_url || "https://placehold.co/600x730?text=Product",
  stock: item.stock == null ? null : Number(item.stock)
}));

  // Keep local products and replace previously loaded database products.
  products = [
    ...products.filter(
      item => !String(item.id).startsWith("supabase-")
    ),
    ...databaseProducts
  ];

  // Refresh the existing website product displays.
  renderFeatured();
  renderProducts(activeFilter, searchInput?.value.trim() || "");
  syncFilterUI();
  updateCartUI();

  console.log(
    "Supabase products integrated successfully:",
    databaseProducts
  );
}

// Load database products when the page opens.
loadSupabaseProducts();


// ========================================
// RESTORE PAGE POSITION AFTER REFRESH
// ========================================

const SCROLL_POSITION_KEY = "jiddamarh-scroll-position";

// Remember the current scroll position.
window.addEventListener("pagehide", () => {
  try {
    sessionStorage.setItem(
      SCROLL_POSITION_KEY,
      String(window.scrollY)
    );
  } catch (error) {
    console.warn("Could not save page position:", error);
  }
});

// Restore the previous position after the page loads.
window.addEventListener("load", () => {
  try {
    const savedPosition = sessionStorage.getItem(
      SCROLL_POSITION_KEY
    );

    if (savedPosition === null) return;

    const position = Number(savedPosition);

    if (!Number.isFinite(position)) return;

    requestAnimationFrame(() => {
      window.scrollTo({
        top: position,
        behavior: "instant"
      });
    });
  } catch (error) {
    console.warn("Could not restore page position:", error);
  }
});
