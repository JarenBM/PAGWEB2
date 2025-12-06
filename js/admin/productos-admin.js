// admin/productos-admin.js
import { supabase } from './js/supabaseClient.js';
import Auth from '../auth.js';

class ProductosAdmin {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentCategory = 'all';
        this.init();
    }

    async init() {
        // Verificar que sea admin
        const isAdmin = await Auth.isAdmin();
        if (!isAdmin) {
            window.location.href = '/catalogo.html';
            return;
        }

        await this.loadCategories();
        await this.loadProducts();
        this.setupEventListeners();
        this.setupRealtime();
    }

    async loadCategories() {
        const { data: categories } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        const categoryFilter = document.getElementById('categoryFilter');
        const modalCategory = document.getElementById('productCategory');
        
        if (categories) {
            const options = categories.map(cat => 
                `<option value="${cat.id}">${cat.name}</option>`
            ).join('');
            
            if (categoryFilter) {
                categoryFilter.innerHTML = `
                    <option value="all">Todas las categorías</option>
                    ${options}
                `;
            }
            
            if (modalCategory) {
                modalCategory.innerHTML = `
                    <option value="">Seleccionar categoría</option>
                    ${options}
                `;
            }
        }
    }

    async loadProducts() {
        try {
            let query = supabase
                .from('products')
                .select(`
                    *,
                    categories(name)
                `)
                .order('created_at', { ascending: false });

            // Filtrar por categoría
            if (this.currentCategory !== 'all') {
                query = query.eq('category_id', this.currentCategory);
            }

            // Paginación
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;
            query = query.range(from, to);

            const { data: products, error, count } = await query;

            if (error) throw error;

            this.displayProducts(products);
            this.updatePagination(count);

        } catch (error) {
            console.error('Error cargando productos:', error);
            this.showError('Error al cargar productos');
        }
    }

    displayProducts(products) {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        if (!products || products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="text-muted">
                            <i class="fas fa-utensils fa-3x mb-3"></i><br>
                            No hay productos registrados
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr data-product-id="${product.id}">
                <td>
                    <div class="d-flex align-items-center">
                        ${product.image_url ? `
                            <img src="${product.image_url}" 
                                 class="rounded me-3" 
                                 style="width: 60px; height: 60px; object-fit: cover;">
                        ` : `
                            <div class="rounded me-3 bg-light d-flex align-items-center justify-content-center"
                                 style="width: 60px; height: 60px;">
                                <i class="fas fa-utensils text-muted"></i>
                            </div>
                        `}
                        <div>
                            <strong class="d-block">${product.name}</strong>
                            <small class="text-muted">${product.categories?.name || 'Sin categoría'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${product.is_active ? 'bg-success' : 'bg-danger'}">
                        ${product.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    ${product.stock <= product.min_stock ? `
                        <span class="badge bg-warning ms-1" title="Stock bajo">
                            <i class="fas fa-exclamation-triangle"></i>
                        </span>
                    ` : ''}
                </td>
                <td class="text-end">${product.stock}</td>
                <td class="text-end">S/. ${parseFloat(product.price).toFixed(2)}</td>
                <td>
                    <small class="text-muted">
                        ${product.preparation_time || 15} min
                    </small>
                </td>
                <td>
                    ${product.short_description ? 
                        `<small class="text-muted">${product.short_description.substring(0, 50)}...</small>` : 
                        '<span class="text-muted">-</span>'}
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" 
                                onclick="productosAdmin.editProduct(${product.id})"
                                title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" 
                                onclick="productosAdmin.confirmDelete(${product.id})"
                                title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-outline-secondary" 
                                onclick="productosAdmin.toggleStatus(${product.id})"
                                title="${product.is_active ? 'Desactivar' : 'Activar'}">
                            <i class="fas ${product.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    setupEventListeners() {
        // Filtro por categoría
        document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.currentPage = 1;
            this.loadProducts();
        });

        // Búsqueda
        document.getElementById('searchProducts')?.addEventListener('input', (e) => {
            this.searchProducts(e.target.value);
        });

        // Botón nuevo producto
        document.getElementById('newProductBtn')?.addEventListener('click', () => {
            this.showProductModal();
        });

        // Guardar producto (modal)
        document.getElementById('saveProductBtn')?.addEventListener('click', async () => {
            await this.saveProduct();
        });

        // Subir imagen
        document.getElementById('productImage')?.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });
    }

    async searchProducts(query) {
        if (!query.trim()) {
            await this.loadProducts();
            return;
        }

        const { data: products } = await supabase
            .from('products')
            .select(`
                *,
                categories(name)
            `)
            .or(`name.ilike.%${query}%,short_description.ilike.%${query}%,description.ilike.%${query}%`)
            .order('created_at', { ascending: false })
            .limit(20);

        this.displayProducts(products);
    }

    showProductModal(product = null) {
        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        const form = document.getElementById('productForm');
        
        // Resetear formulario
        form.reset();
        document.getElementById('productId').value = '';
        document.getElementById('modalTitle').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
        document.getElementById('productImagePreview').innerHTML = '';

        // Si es edición, cargar datos
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productSlug').value = product.slug;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productStock').value = product.stock;
            document.getElementById('productMinStock').value = product.min_stock || 5;
            document.getElementById('productCategory').value = product.category_id || '';
            document.getElementById('productShortDesc').value = product.short_description || '';
            document.getElementById('productDesc').value = product.description || '';
            document.getElementById('productPrepTime').value = product.preparation_time || 15;
            document.getElementById('productActive').checked = product.is_active !== false;

            // Mostrar imagen actual si existe
            if (product.image_url) {
                document.getElementById('productImagePreview').innerHTML = `
                    <img src="${product.image_url}" class="img-thumbnail" style="max-height: 200px;">
                    <small class="d-block mt-1">Imagen actual</small>
                `;
            }
        }

        modal.show();
    }

    async handleImageUpload(file) {
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Solo se permiten imágenes JPG, PNG o WebP');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert('La imagen no debe superar 5MB');
            return;
        }

        // Mostrar preview
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('productImagePreview').innerHTML = `
                <img src="${e.target.result}" class="img-thumbnail" style="max-height: 200px;">
            `;
        };
        reader.readAsDataURL(file);

        // Subir a Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2)}.${fileExt}`;
        const filePath = `productos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) {
            alert('Error al subir imagen');
            return;
        }

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        document.getElementById('imageUrl').value = publicUrl;
    }

    async saveProduct() {
        const form = document.getElementById('productForm');
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const productData = {
            name: document.getElementById('productName').value,
            slug: document.getElementById('productSlug').value || 
                  this.generateSlug(document.getElementById('productName').value),
            price: parseFloat(document.getElementById('productPrice').value),
            stock: parseInt(document.getElementById('productStock').value),
            min_stock: parseInt(document.getElementById('productMinStock').value),
            category_id: document.getElementById('productCategory').value || null,
            short_description: document.getElementById('productShortDesc').value,
            description: document.getElementById('productDesc').value,
            preparation_time: parseInt(document.getElementById('productPrepTime').value),
            is_active: document.getElementById('productActive').checked,
            image_url: document.getElementById('imageUrl').value || null
        };

        const productId = document.getElementById('productId').value;
        let error;

        if (productId) {
            // Actualizar
            const { error: updateError } = await supabase
                .from('products')
                .update(productData)
                .eq('id', productId);
            error = updateError;
        } else {
            // Crear nuevo
            const { error: insertError } = await supabase
                .from('products')
                .insert([productData]);
            error = insertError;
        }

        if (error) {
            alert('Error al guardar producto: ' + error.message);
        } else {
            bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
            await this.loadProducts();
            this.showToast('Producto guardado correctamente', 'success');
        }
    }

    async editProduct(productId) {
        const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (product) {
            this.showProductModal(product);
        }
    }

    async confirmDelete(productId) {
        if (!confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
            return;
        }

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            alert('Error al eliminar producto');
        } else {
            await this.loadProducts();
            this.showToast('Producto eliminado', 'success');
        }
    }

    async toggleStatus(productId) {
        const { data: product } = await supabase
            .from('products')
            .select('is_active')
            .eq('id', productId)
            .single();

        if (!product) return;

        const { error } = await supabase
            .from('products')
            .update({ is_active: !product.is_active })
            .eq('id', productId);

        if (error) {
            alert('Error al cambiar estado');
        } else {
            await this.loadProducts();
            this.showToast('Estado actualizado', 'success');
        }
    }

    generateSlug(name) {
        return name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
            .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres no alfanuméricos
            .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final
    }

    updatePagination(totalCount) {
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);
        const pagination = document.getElementById('productsPagination');
        
        if (!pagination || totalPages <= 1) {
            if (pagination) pagination.innerHTML = '';
            return;
        }

        let html = `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="productosAdmin.goToPage(${this.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
            </li>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `
                    <li class="page-item ${this.currentPage === i ? 'active' : ''}">
                        <button class="page-link" onclick="productosAdmin.goToPage(${i})">
                            ${i}
                        </button>
                    </li>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }

        html += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="productosAdmin.goToPage(${this.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </li>
        `;

        pagination.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadProducts();
        window.scrollTo(0, 0);
    }

    setupRealtime() {
        // Escuchar cambios en productos
        supabase.channel('products-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'products' }, 
                () => this.loadProducts()
            )
            .subscribe();
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        const container = document.getElementById('toastContainer') || (() => {
            const div = document.createElement('div');
            div.id = 'toastContainer';
            div.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(div);
            return div;
        })();

        container.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        // Remover después de animación
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    showError(message) {
        this.showToast(message, 'danger');
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.productosAdmin = new ProductosAdmin();
});