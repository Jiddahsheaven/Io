/* ========================================
   JIDDERHS HEAVEN — CHECKOUT DEBUGGER
======================================== */

(() => {
  "use strict";

  console.log(
    "%c CHECKOUT DEBUGGER ",
    "background:#174;color:#fff;padding:8px;font-weight:bold;"
  );

  console.info("Checkout page:", location.href);
  console.info("Checkout debugger initialized.");

  // Detect JavaScript errors
  window.addEventListener("error", (event) => {
    console.error("❌ CHECKOUT JAVASCRIPT ERROR", {
      message: event.message,
      file: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  // Detect failed asynchronous operations
  window.addEventListener("unhandledrejection", (event) => {
    console.error(
      "❌ CHECKOUT ASYNC ERROR:",
      event.reason
    );
  });

  // Inspect checkout form elements
  window.addEventListener("DOMContentLoaded", () => {
    console.group("🔍 CHECKOUT DIAGNOSTICS");

    const selectors = [
  "#checkoutForm",
  "#placeOrderButton",
  "#customerEmail",
  "#customerName",
  "#customerPhone",
  "#deliveryAddress",
  "#checkoutItems",
  "#checkoutTotal",
  "#checkoutMessage"
];

    selectors.forEach((selector) => {
      const element = document.querySelector(selector);

      console.log(
        element ? "✅ Found:" : "⚠️ Not found:",
        selector
      );
    });

    console.log("Checkout DOM ready:", document.readyState);

    console.groupEnd();
  });

})();


import { supabase } from "./supabase.js";

const CART_KEY = "jiddamarh-cart";

const form = document.querySelector("#checkoutForm");
const itemsContainer = document.querySelector("#checkoutItems");
const totalElement = document.querySelector("#checkoutTotal");
const message = document.querySelector("#checkoutMessage");
const submitButton = document.querySelector("#placeOrderButton");

let cart = [];

function formatNaira(amount) {
  return Number(amount).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2
  });
}

function loadCart() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]"
    );

    cart = Array.isArray(saved) ? saved : [];
  } catch {
    cart = [];
  }
}

function renderOrder() {
  itemsContainer.replaceChildren();

  let total = 0;

  for (const item of cart) {
    const quantity = Number(item.qty);
    const price = Number(item.price);

    if (
      !Number.isFinite(quantity) ||
      quantity < 1 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      continue;
    }

    total += price * quantity;

    const row = document.createElement("p");

    row.textContent =
      `${item.name} × ${quantity} — ${formatNaira(price * quantity)}`;

    itemsContainer.appendChild(row);
  }

  totalElement.textContent = formatNaira(total);

  if (!cart.length) {
    itemsContainer.textContent = "Your bag is empty.";
    submitButton.disabled = true;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  loadCart();

  if (!cart.length) {
    message.textContent = "Your bag is empty.";
    renderOrder();
    return;
  }

  const customerName =
    document.querySelector("#customerName").value.trim();

  const customerEmail =
    document.querySelector("#customerEmail").value.trim();

  const customerPhone =
    document.querySelector("#customerPhone").value.trim();

  const deliveryAddress =
    document.querySelector("#deliveryAddress").value.trim();

  const items = cart.map((item) => {
  const productId = String(item.id).replace(/^supabase-/, "");

  return {
    product_id: productId,
    quantity: Number(item.qty)
  };
});

if (
  items.some(item =>
    !/^[1-9]\d*$/.test(item.product_id) ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1
  )
) {
  message.textContent =
    "One or more products have invalid IDs. Please refresh your bag and try again.";
  return;
}

  submitButton.disabled = true;
  message.textContent = "Submitting your order...";

  try {
 console.log("Sending order to create-order:", {
  customer_name: customerName,
  customer_email: customerEmail,
  items
});
    const { data, error } = await supabase.functions.invoke(
      "create-order",
      {
        body: {
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          items
        }
      }
    );

    if (error) {
  console.error("Edge Function invocation error:", error);
  console.error("Checkout error:", error);

  let details = null;

  try {
    details = await error.context?.clone().json();
  } catch (e) {
    console.error("Could not read error details:", e);
  }

  message.textContent =
    details?.error || error.message;

  return;
}

if (!data?.success || !data?.order_id) {
  throw new Error(
    data?.error ||
    "The server did not return an order reference."
  );
}

message.textContent =
  `Your order was created successfully. Reference: ${data.order_id}. Payment has not been processed.`;

localStorage.removeItem(CART_KEY);
cart = [];
renderOrder();
form.reset();
  } catch (error) {
    console.error("Order submission failed:", error);

    message.textContent =
      error.message || "We could not submit your order. Please try again.";
  } finally {
    submitButton.disabled = cart.length === 0;
  }
});

loadCart();
renderOrder();