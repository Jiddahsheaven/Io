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

  const items = cart.map((item) => ({
    product_id: String(item.id).replace(/^supabase-/, ""),
    quantity: Number(item.qty)
  }));

  if (
    items.some(item =>
      !/^\d+$/.test(item.product_id) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
  ) {
    message.textContent =
      "Some products have invalid database IDs. Please contact the store.";
    return;
  }

  submitButton.disabled = true;
  message.textContent = "Submitting your order...";

  try {
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

    if (error) throw error;

    if (!data?.order?.id) {
      throw new Error(
        data?.error || "The server did not return an order reference."
      );
    }

    message.textContent =
      `Your order was created successfully. Reference: ${data.order.id}. Payment has not been processed.`;

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