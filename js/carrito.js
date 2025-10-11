document.addEventListener("DOMContentLoaded", () => {
  const cartBody = document.getElementById("cart-body");
  const subtotalEl = document.getElementById("subtotal");
  const envioEl = document.getElementById("envio");
  const totalEl = document.getElementById("total");
  const finalizarBtn = document.getElementById("finalizar-compra");

  let carrito = [];
  const envio = 5;

  // Añadir producto
  document.querySelectorAll(".btn-add-cart").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nombre = btn.dataset.nombre;
      const precio = parseFloat(btn.dataset.precio);
      const imagen = btn.dataset.imagen;

      const existente = carrito.find((item) => item.nombre === nombre);
      if (existente) {
        existente.cantidad++;
      } else {
        carrito.push({ nombre, precio, cantidad: 1, imagen });
      }
      renderCarrito();
    });
  });

  // Renderizar carrito
  function renderCarrito() {
    cartBody.innerHTML = "";
    let subtotal = 0;

    carrito.forEach((item, index) => {
      subtotal += item.precio * item.cantidad;

      cartBody.innerHTML += `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <img src="${item.imagen}" alt="${item.nombre}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; margin-right: 10px;">
              <div>
                <strong>${item.nombre}</strong><br>
                <small>S/. ${item.precio.toFixed(2)}</small>
              </div>
            </div>
          </td>
          <td>
            <input type="number" min="1" value="${item.cantidad}" class="form-control form-control-sm cantidad-input" data-index="${index}">
          </td>
          <td>
            <button class="btn btn-sm btn-outline-danger btn-remove" data-index="${index}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });

    subtotalEl.textContent = `S/. ${subtotal.toFixed(2)}`;
    envioEl.textContent = carrito.length > 0 ? `S/. ${envio.toFixed(2)}` : "S/. 0.00";
    totalEl.textContent = carrito.length > 0 ? `S/. ${(subtotal + envio).toFixed(2)}` : "S/. 0.00";

    // Eliminar producto
    document.querySelectorAll(".btn-remove").forEach((btn) =>
      btn.addEventListener("click", () => {
        const index = btn.dataset.index;
        carrito.splice(index, 1);
        renderCarrito();
      })
    );

    // Cambiar cantidad
    document.querySelectorAll(".cantidad-input").forEach((input) =>
      input.addEventListener("change", (e) => {
        const index = e.target.dataset.index;
        carrito[index].cantidad = parseInt(e.target.value);
        renderCarrito();
      })
    );
  }

  // Mostrar modal login al finalizar compra
  finalizarBtn.addEventListener("click", () => {
    if (carrito.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }
    const loginModal = new bootstrap.Modal(document.getElementById("loginModal"));
    loginModal.show();
  });

  // Validar login
  document.getElementById("btnLogin").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const alertEl = document.getElementById("loginAlert");

    if (!email || !password) {
      alertEl.classList.remove("d-none");
      return;
    }

    alertEl.classList.add("d-none");
    const loginModal = bootstrap.Modal.getInstance(document.getElementById("loginModal"));
    loginModal.hide();

    // Mostrar modal de éxito
    const successModal = new bootstrap.Modal(document.getElementById("successModal"));
    successModal.show();

    // Vaciar carrito
    carrito = [];
    renderCarrito();
  });
});
