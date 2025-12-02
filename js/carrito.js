// js/carrito.js
// Carrito funcional para el carrito.html que pegaste.
// Guarda en localStorage, renderiza tabla, calcula totales, controla modales.

(function () {
  const STORAGE_KEY = "chifa_cart_v1";

  // Reglas de negocio
  const ENVIO_BASE = 5.00;        // costo de envío por defecto
  const ENVIO_GRATIS_SOBRE = 50;  // envío gratis si subtotal >= este valor

  // Helpers
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const formatMoney = (n) => {
    // formatea en "S/. 12.34"
    return `S/. ${Number(n).toFixed(2)}`;
  };

  // Carga desde localStorage
  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("Error leyendo carrito:", e);
      return {};
    }
  }

  // Guarda y actualiza UI
  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    renderCart(cart);
  }

  // Calcula subtotal
  function calcSubtotal(cart) {
    return Object.values(cart).reduce((s, it) => s + (Number(it.price) * Number(it.qty)), 0);
  }

  // Calcula envio segun reglas
  function calcEnvio(subtotal) {
    if (subtotal >= ENVIO_GRATIS_SOBRE) return 0;
    if (subtotal <= 0) return 0;
    return ENVIO_BASE;
  }

  // Render de la tabla del carrito (tbody id="cart-body")
  function renderCart(cart) {
    const tbody = $("#cart-body");
    const subtotalEl = $("#subtotal");
    const envioEl = $("#envio");
    const totalEl = $("#total");

    if (!tbody || !subtotalEl || !envioEl || !totalEl) {
      console.warn("Elementos del carrito no encontrados en DOM.");
      return;
    }

    tbody.innerHTML = "";

    const items = Object.values(cart);
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center">No hay productos en el carrito.</td></tr>`;
    } else {
      items.forEach(item => {
        // cada fila: producto | cantidad | acciones
        // adaptado a tu cabecera (Producto, Cant., '')
        const tr = document.createElement("tr");

        // Col 1: imagen + nombre + precio unitario
        const tdProd = document.createElement("td");
        tdProd.style.minWidth = "220px";
        tdProd.innerHTML = `
          <div class="d-flex align-items-center gap-2">
            <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name)}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.05)">
            <div>
              <div class="fw-semibold">${escapeHtml(item.name)}</div>
              <div class="text-muted small">S/. ${Number(item.price).toFixed(2)} c/u</div>
            </div>
          </div>
        `;

        // Col 2: cantidad + controls
        const tdQty = document.createElement("td");
        tdQty.className = "text-center";
        tdQty.innerHTML = `
          <div class="d-flex align-items-center justify-content-center gap-2">
            <button class="btn btn-sm btn-outline-secondary btn-decrease" data-id="${item.id}">-</button>
            <div class="px-2">${Number(item.qty)}</div>
            <button class="btn btn-sm btn-outline-secondary btn-increase" data-id="${item.id}">+</button>
          </div>
        `;

        // Col 3: subtotal línea + eliminar
        const tdActions = document.createElement("td");
        tdActions.className = "text-end";
        const lineTotal = Number(item.qty) * Number(item.price);
        tdActions.innerHTML = `
          <div class="fw-bold">S/. ${lineTotal.toFixed(2)}</div>
          <div class="mt-1">
            <button class="btn btn-sm btn-link text-danger btn-remove" data-id="${item.id}">Eliminar</button>
          </div>
        `;

        tr.appendChild(tdProd);
        tr.appendChild(tdQty);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    }

    const subtotal = calcSubtotal(cart);
    const envio = calcEnvio(subtotal);
    const total = subtotal + envio;

    subtotalEl.textContent = formatMoney(subtotal);
    envioEl.textContent = formatMoney(envio);
    totalEl.textContent = formatMoney(total);
  }

  // Escapa texto para evitar inyección al renderizar HTML
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // API pública para interacción por otros scripts
  const CART = {
    add(item) {
      // item: { id, name, price, image, qty }
      if (!item || !item.id) return;
      const cart = loadCart();
      if (!cart[item.id]) {
        cart[item.id] = {
          id: item.id,
          name: item.name || "Producto",
          price: Number(item.price) || 0,
          image: item.image || "",
          qty: Number(item.qty) || 1
        };
      } else {
        cart[item.id].qty = Number(cart[item.id].qty) + (Number(item.qty) || 1);
      }
      saveCart(cart);
      showToast(`${item.name} agregado al carrito`);
    },
    setQty(id, qty) {
      const cart = loadCart();
      if (!cart[id]) return;
      cart[id].qty = Number(qty);
      if (cart[id].qty <= 0) delete cart[id];
      saveCart(cart);
    },
    remove(id) {
      const cart = loadCart();
      if (!cart[id]) return;
      delete cart[id];
      saveCart(cart);
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
      renderCart({});
    },
    get() {
      return loadCart();
    },
    // EL NUEVO BLOQUE PARA LA CONEXIÓN CON SUPABASE
    async checkout() {
  const cart = loadCart();
  if (Object.keys(cart).length === 0) {
    showToast("El carrito está vacío", true);
    return;
  }

  // 1. Verificar si el usuario está logueado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showToast("Debes iniciar sesión para continuar", true);
    const loginModalEl = document.getElementById("loginModal");
    if (loginModalEl) {
      const mdl = new bootstrap.Modal(loginModalEl);
      mdl.show();
    }
    return;
  }

  // 2. Cálculos
  const items = Object.values(cart);
  const subtotal = calcSubtotal(cart);
  const envio = calcEnvio(subtotal);
  const total = subtotal + envio;

  // 3. Insertar pedido
  const { data: pedido, error: errPedido } = await supabase
    .from("pedidos")
    .insert({
      usuario_id: user.id,
      subtotal,
      envio,
      total,
      estado: "pendiente",
      creado_en: new Date().toISOString()
    })
    .select()
    .single();

  if (errPedido) {
    console.error(errPedido);
    showToast("Error al registrar pedido", true);
    return;
  }

  // 4. Insertar cada item del carrito
  const detalles = items.map(it => ({
    pedido_id: pedido.id,
    producto_id: it.id,
    cantidad: it.qty,
    precio_unit: it.price
  }));

  const { error: errItems } = await supabase
    .from("pedido_items")
    .insert(detalles);

  if (errItems) {
    console.error(errItems);
    showToast("Error al registrar detalles", true);
    return;
  }

  // 5. Mostrar modal de éxito
  const successModalEl = document.getElementById("successModal");
  if (successModalEl) {
    const mdl = new bootstrap.Modal(successModalEl);
    mdl.show();
  }

  // 6. Limpiar carrito
  setTimeout(() => {
    CART.clear();
  }, 800);

  showToast("¡Pedido realizado con éxito!");
}

  };

  // Notificación simple (toast usando element temporal)
  function showToast(message, isError = false) {
    // Si tu proyecto ya tiene un sistema de toast, conéctalo aquí.
    // Aquí creamos un toast simple y lo destruimos.
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.right = "20px";
    div.style.bottom = "20px";
    div.style.zIndex = 1200;
    div.style.padding = "12px 16px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#333" : "#c62828";
    div.style.color = "#fff";
    div.style.boxShadow = "0 6px 20px rgba(0,0,0,0.18)";
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transition = "opacity 300ms";
    }, 1200);
    setTimeout(() => div.remove(), 1600);
  }

  // Delegación de eventos para botones en la UI
  document.addEventListener("click", function (e) {
    const inc = e.target.closest(".btn-increase");
    const dec = e.target.closest(".btn-decrease");
    const rem = e.target.closest(".btn-remove");
    const addBtn = e.target.closest(".btn-add-cart"); // coincide con tu HTML
    const finalizar = e.target.closest("#finalizar-compra");

    if (addBtn) {
      // leer datos desde atributos data-*
      const name = addBtn.dataset.nombre || addBtn.dataset.name;
      const price = parseFloat(addBtn.dataset.precio || addBtn.dataset.price || 0);
      const image = addBtn.dataset.imagen || addBtn.dataset.image || "";
      const id = addBtn.dataset.id || (`p_${Math.random().toString(36).slice(2,9)}`);

      CART.add({ id, name, price, image, qty: 1 });
      return;
    }

    if (inc) {
      const id = inc.dataset.id;
      const cart = CART.get();
      if (!cart[id]) return;
      CART.setQty(id, Number(cart[id].qty) + 1);
      return;
    }

    if (dec) {
      const id = dec.dataset.id;
      const cart = CART.get();
      if (!cart[id]) return;
      CART.setQty(id, Number(cart[id].qty) - 1);
      return;
    }

    if (rem) {
      const id = rem.dataset.id;
      CART.remove(id);
      return;
    }

    if (finalizar) {
      // Si quieres exigir login, aquí puedes comprobarlo y abrir #loginModal
      // Por ahora mostraremos el modal de login si existe, sino procederemos a checkout.
      const loginModalEl = document.getElementById("loginModal");
      if (loginModalEl) {
        // lógica simple: si no existe "user_logged" en localStorage pedimos login
        const user = localStorage.getItem("chifa_user_demo");
        if (!user) {
          const loginModal = new bootstrap.Modal(loginModalEl);
          loginModal.show();
          return;
        }
      }
      // procede a checkout
      CART.checkout();
      return;
    }
  });

  // Listener para botones del modal login (demo)
  document.addEventListener("DOMContentLoaded", function () {
    // Inicializar render
    renderCart(loadCart());

    // Login demo: si presionan Iniciar sesión en modal, marcar usuario y cerrar
    const btnLogin = document.getElementById("btnLogin");
    if (btnLogin) {
      btnLogin.addEventListener("click", function () {
        const email = document.getElementById("loginEmail")?.value?.trim();
        const pass = document.getElementById("loginPassword")?.value?.trim();
        const alertEl = document.getElementById("loginAlert");
        if (!email || !pass) {
          if (alertEl) {
            alertEl.classList.remove("d-none");
            alertEl.textContent = "Por favor, complete ambos campos.";
          }
          return;
        }
        // Demo: guardamos un indicador de usuario (en producción usar Supabase Auth)
        localStorage.setItem("chifa_user_demo", JSON.stringify({ email }));
        // cerrar modal
        const loginModalEl = document.getElementById("loginModal");
        if (loginModalEl) {
          const mdl = bootstrap.Modal.getInstance(loginModalEl) || new bootstrap.Modal(loginModalEl);
          mdl.hide();
        }
        showToast("Sesión iniciada");
      });
    }

    // Si el modal de éxito existe, aseguramos que al cerrarlo no quede nada raro
    const successModalEl = document.getElementById("successModal");
    if (successModalEl) {
      successModalEl.addEventListener("hidden.bs.modal", function () {
        // nada por ahora
      });
    }
  });

})();
