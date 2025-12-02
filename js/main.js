/* ==========================
   ANIMAR NAVBAR AL HACER SCROLL
========================== */
window.addEventListener("scroll", () => {
    const nav = document.querySelector(".navbar-custom");

    if (!nav) return;

    if (window.scrollY > 20) {
        nav.style.background = "#111";
        nav.style.boxShadow = "0 4px 12px rgba(0,0,0,0.20)";
    } else {
        nav.style.background = "var(--color-dark)";
        nav.style.boxShadow = "none";
    }
});

/* ==========================
   BOTÓN VOLVER ARRIBA
========================== */
const btnTop = document.createElement("div");
btnTop.textContent = "↑";
btnTop.style.position = "fixed";
btnTop.style.bottom = "22px";
btnTop.style.right = "22px";
btnTop.style.background = "var(--color-primary)";
btnTop.style.color = "#fff";
btnTop.style.width = "45px";
btnTop.style.height = "45px";
btnTop.style.display = "flex";
btnTop.style.alignItems = "center";
btnTop.style.justifyContent = "center";
btnTop.style.borderRadius = "50%";
btnTop.style.cursor = "pointer";
btnTop.style.fontSize = "1.5rem";
btnTop.style.opacity = "0";
btnTop.style.transition = "0.3s";
btnTop.style.zIndex = "999";

document.body.appendChild(btnTop);

window.addEventListener("scroll", () => {
    btnTop.style.opacity = window.scrollY > 200 ? "1" : "0";
});

btnTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ==========================
   FUTURA INTEGRACIÓN CON SUPABASE
========================== */

async function fetchProductos() {
    console.log("Aquí luego conectamos Supabase");
}

/* ==========================
   AGREGAR AL CARRITO (GENÉRICO)
========================== */
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-add")) {
        const nombre = e.target.dataset.nombre;
        const precio = e.target.dataset.precio;

        alert(`Añadido: ${nombre} - S/${precio}`);

        // Aquí luego llamaremos a Supabase
    }
});
