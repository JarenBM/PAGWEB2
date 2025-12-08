import { supabase } from "./supabaseClient.js";

// ===============================
// 🛒 CARRITO LOCAL
// ===============================
let cart = JSON.parse(localStorage.getItem("cart")) || [];

const cartBody = document.getElementById("cart-body");
const subtotalEl = document.getElementById("subtotal");
const envioEl = document.getElementById("envio");
const totalEl = document.getElementById("total");
const finalizarBtn = document.getElementById("finalizar-compra");
const productsContainer = document.getElementById("products-container");

// ===============================
// 📦 CARGAR PRODUCTOS DESDE SUPABASE
// ===============================
async function loadProducts() {
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando productos:", error);
    return;
  }

  productsContainer.innerHTML = "";

  products.forEach((product) => {
    productsContainer.innerHTML += `
      <div class="col-md-3">
        <div class="card h-100">
          <img src="${product.image_url || 'img/no-image.png'}" class="card-img-top">
          <div class="card-body d-flex flex-column">
            <h5>${product.name}</h5>
            <p class="text-muted">${product.short_description || ""}</p>
            <p class="fw-bold mt-auto">S/${product.price}</p>
            <button 
              class="btn btn-danger mt-2"
              onclick="addToCart('${product.id}', '${product.name}', ${product.price})"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

window.addToCart = (id, name, price) => {
  const existing = cart.find((p) => p.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
};

// ===============================
// 🖼️ RENDER CARRITO
// ===============================
function renderCart() {
  cartBody.innerHTML = "";
  let subtotal = 0;

  cart.forEach((item, index) => {
    subtotal += item.qty * item.price;

    cartBody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="decrement(${index})">-</button>
          ${item.qty}
          <button class="btn btn-sm btn-secondary" onclick="increment(${index})">+</button>
        </td>
        <td>S/${(item.qty * item.price).toFixed(2)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="removeItem(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  const envio = subtotal > 0 ? 5 : 0;
  const total = subtotal + envio;

  subtotalEl.textContent = `S/${subtotal.toFixed(2)}`;
  envioEl.textContent = `S/${envio.toFixed(2)}`;
  totalEl.textContent = `S/${total.toFixed(2)}`;

  localStorage.setItem("cart", JSON.stringify(cart));
}

window.increment = (i) => {
  cart[i].qty++;
  renderCart();
};

window.decrement = (i) => {
  if (cart[i].qty > 1) cart[i].qty--;
  renderCart();
};

window.removeItem = (i) => {
  cart.splice(i, 1);
  renderCart();
};

renderCart();
loadProducts();

// ===============================
// 🔐 FINALIZAR COMPRA REAL
// ===============================
finalizarBtn.addEventListener("click", async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  // ✅ VALIDACIÓN REAL DE SESIÓN
  if (!user) {
    alert("Debes iniciar sesión para finalizar tu compra.");

    // ✅ Guardamos que el usuario quiso comprar
    localStorage.setItem("redirect_after_login", "carrito");

    // ✅ Redirigimos al login REAL
    window.location.href = "Pages/auth/login.html";
    return;
  }

  if (cart.length === 0) {
    alert("Tu carrito está vacío");
    return;
  }


  try {
    // Obtener perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, address")
      .eq("id", user.id)
      .single();

    const total = parseFloat(totalEl.textContent.replace("S/", ""));

    // Crear pedido
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        customer_name: profile?.full_name || "Cliente",
        customer_email: profile?.email || user.email,
        customer_phone: profile?.phone || "000000000",
        delivery_address: profile?.address || "Local",
        total,
        order_status: "pendiente",
        order_type: "local"
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Crear order_items reales
    const items = cart.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.qty
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(items);

    if (itemsError) throw itemsError;

    cart = [];
    localStorage.removeItem("cart");
    renderCart();

    alert("✅ Pedido registrado correctamente");

  } catch (error) {
    console.error("Error finalizando compra:", error);
    alert("Error al procesar el pedido");
  }
});
