// admin/usuarios-admin.js
import { supabase } from './js/supabaseClient.js';
import Auth from './auth.js';

class UsuariosAdmin {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }

    async init() {
        // Verificar que sea superadmin o admin
        const isSuperAdmin = await Auth.hasRole('superadmin');
        const isAdmin = await Auth.hasRole('admin');
        
        if (!isSuperAdmin && !isAdmin) {
            window.location.href = '/catalogo.html';
            return;
        }

        await this.loadUsers();
        this.setupEventListeners();
    }

    async loadUsers() {
        try {
            let query = supabase
                .from('profiles')
                .select(`
                    *,
                    user_roles(role),
                    orders(count)
                `)
                .order('created_at', { ascending: false });

            // Paginación
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;
            query = query.range(from, to);

            const { data: users, error, count } = await query;

            if (error) throw error;

            this.displayUsers(users);
            this.updatePagination(count);

        } catch (error) {
            console.error('Error cargando usuarios:', error);
            this.showError('Error al cargar usuarios');
        }
    }

    displayUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="text-muted">
                            <i class="fas fa-users fa-3x mb-3"></i><br>
                            No hay usuarios registrados
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const currentUser = Auth.getCurrentUser();
        
        tbody.innerHTML = users.map(user => {
            const roles = user.user_roles?.map(r => r.role) || ['cliente'];
            const isCurrentUser = currentUser?.id === user.id;
            
            return `
                <tr data-user-id="${user.id}">
                    <td>
                        <div class="d-flex align-items-center">
                            ${user.avatar_url ? `
                                <img src="${user.avatar_url}" 
                                     class="rounded-circle me-3" 
                                     style="width: 40px; height: 40px; object-fit: cover;">
                            ` : `
                                <div class="rounded-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center"
                                     style="width: 40px; height: 40px;">
                                    ${user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            `}
                            <div>
                                <strong class="d-block">${user.full_name || 'Sin nombre'}</strong>
                                <small class="text-muted">${user.email}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${roles.map(role => `
                            <span class="badge ${this.getRoleBadgeClass(role)}">
                                ${this.getRoleLabel(role)}
                            </span>
                        `).join(' ')}
                    </td>
                    <td>
                        ${user.phone || '<span class="text-muted">-</span>'}
                    </td>
                    <td>
                        ${user.orders?.[0]?.count || 0} pedidos
                    </td>
                    <td>
                        ${new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" 
                                    onclick="usuariosAdmin.editUser('${user.id}')"
                                    title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!isCurrentUser ? `
                                <button class="btn btn-outline-warning" 
                                        onclick="usuariosAdmin.manageRoles('${user.id}')"
                                        title="Gestionar roles">
                                    <i class="fas fa-user-tag"></i>
                                </button>
                                <button class="btn btn-outline-danger" 
                                        onclick="usuariosAdmin.confirmDeleteUser('${user.id}')"
                                        title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : `
                                <button class="btn btn-outline-secondary" disabled title="Usuario actual">
                                    <i class="fas fa-user"></i>
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async editUser(userId) {
        const { data: user } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!user) return;

        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        const form = document.getElementById('userForm');
        
        form.reset();
        document.getElementById('userId').value = userId;
        document.getElementById('userFullName').value = user.full_name || '';
        document.getElementById('userEmail').value = user.email || '';
        document.getElementById('userPhone').value = user.phone || '';
        document.getElementById('userAddress').value = user.address || '';
        document.getElementById('userDni').value = user.dni || '';

        modal.show();
    }

    async saveUser() {
        const form = document.getElementById('userForm');
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const userData = {
            full_name: document.getElementById('userFullName').value,
            phone: document.getElementById('userPhone').value,
            address: document.getElementById('userAddress').value,
            dni: document.getElementById('userDni').value,
            updated_at: new Date().toISOString()
        };

        const userId = document.getElementById('userId').value;

        const { error } = await supabase
            .from('profiles')
            .update(userData)
            .eq('id', userId);

        if (error) {
            alert('Error al guardar usuario: ' + error.message);
        } else {
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            await this.loadUsers();
            this.showToast('Usuario actualizado', 'success');
        }
    }

    async manageRoles(userId) {
        const { data: currentRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId);

        const availableRoles = [
            { value: 'cliente', label: 'Cliente' },
            { value: 'admin', label: 'Administrador' },
            { value: 'chef', label: 'Chef/Cocina' },
            { value: 'delivery', label: 'Repartidor' },
            { value: 'superadmin', label: 'Super Admin' }
        ];

        // Verificar si el usuario actual es superadmin
        const isSuperAdmin = await Auth.hasRole('superadmin');
        
        // Filtrar roles disponibles (solo superadmin puede asignar superadmin)
        const filteredRoles = availableRoles.filter(role => 
            role.value !== 'superadmin' || isSuperAdmin
        );

        const roleCheckboxes = filteredRoles.map(role => {
            const isChecked = currentRoles?.some(r => r.role === role.value);
            return `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" 
                           value="${role.value}" 
                           id="role-${role.value}"
                           ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label" for="role-${role.value}">
                        ${role.label}
                    </label>
                </div>
            `;
        }).join('');

        const rolesHTML = `
            <form id="rolesForm">
                <div class="mb-3">
                    ${roleCheckboxes}
                </div>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    Un usuario puede tener múltiples roles simultáneamente.
                </div>
            </form>
        `;

        const selectedRoles = await this.showModalDialog(
            'Gestionar Roles de Usuario',
            rolesHTML,
            'primary',
            'Guardar Roles'
        );

        if (selectedRoles) {
            await this.updateUserRoles(userId, selectedRoles);
        }
    }

    async updateUserRoles(userId, roles) {
        // Eliminar roles actuales
        const { error: deleteError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            alert('Error al eliminar roles anteriores');
            return;
        }

        // Insertar nuevos roles
        if (roles.length > 0) {
            const rolesData = roles.map(async role => ({
                user_id: userId,
                role: role,
                assigned_by: (await Auth.getCurrentUser())?.id,
                assigned_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('user_roles')
                .insert(rolesData);

            if (insertError) {
                alert('Error al asignar nuevos roles');
                return;
            }
        }

        await this.loadUsers();
        this.showToast('Roles actualizados', 'success');
    }

    async confirmDeleteUser(userId) {
        // No permitir eliminar al usuario actual
        const currentUser = await Auth.getCurrentUser();
        if (currentUser?.id === userId) {
            alert('No puedes eliminar tu propia cuenta');
            return;
        }

        if (!confirm('¿Estás seguro de eliminar este usuario? Se eliminarán todos sus datos.')) {
            return;
        }

        // Primero eliminar del auth de Supabase
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        
        if (authError) {
            alert('Error al eliminar usuario: ' + authError.message);
            return;
        }

        await this.loadUsers();
        this.showToast('Usuario eliminado', 'success');
    }

    async searchUsers(query) {
        if (!query.trim()) {
            await this.loadUsers();
            return;
        }

        const { data: users } = await supabase
            .from('profiles')
            .select(`
                *,
                user_roles(role),
                orders(count)
            `)
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
            .order('created_at', { ascending: false })
            .limit(20);

        this.displayUsers(users);
    }

    getRoleBadgeClass(role) {
        const classes = {
            'superadmin': 'bg-danger',
            'admin': 'bg-primary',
            'chef': 'bg-warning text-dark',
            'delivery': 'bg-info text-dark',
            'cliente': 'bg-secondary'
        };
        return classes[role] || 'bg-secondary';
    }

    getRoleLabel(role) {
        const labels = {
            'superadmin': 'Super Admin',
            'admin': 'Admin',
            'chef': 'Chef',
            'delivery': 'Delivery',
            'cliente': 'Cliente'
        };
        return labels[role] || role;
    }

    async showModalDialog(title, content, btnClass = 'primary', btnText = 'Aceptar') {
        return new Promise((resolve) => {
            const modalId = 'customModal-' + Date.now();
            const modalHTML = `
                <div class="modal fade" id="${modalId}" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                ${content}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-${btnClass}" id="${modalId}-confirm">
                                    ${btnText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = new bootstrap.Modal(document.getElementById(modalId));
            const confirmBtn = document.getElementById(`${modalId}-confirm`);

            let result = null;

            if (btnText === 'Guardar Roles') {
                confirmBtn.addEventListener('click', () => {
                    const checkboxes = document.querySelectorAll(`#${modalId} .form-check-input:checked`);
                    result = Array.from(checkboxes).map(cb => cb.value);
                    modal.hide();
                });
            } else {
                confirmBtn.addEventListener('click', () => {
                    result = true;
                    modal.hide();
                });
            }

            modal.show();

            document.getElementById(modalId).addEventListener('hidden.bs.modal', function () {
                this.remove();
                resolve(result);
            });
        });
    }

    setupEventListeners() {
        // Búsqueda
        document.getElementById('searchUsers')?.addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });

        // Guardar usuario
        document.getElementById('saveUserBtn')?.addEventListener('click', async () => {
            await this.saveUser();
        });

        // Nuevo usuario
        document.getElementById('newUserBtn')?.addEventListener('click', () => {
            this.showNewUserModal();
        });
    }

    showNewUserModal() {
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        const form = document.getElementById('userForm');
        
        form.reset();
        document.getElementById('userId').value = '';
        document.getElementById('modalTitle').textContent = 'Nuevo Usuario';
        
        // Deshabilitar email en creación (se crea con auth)
        document.getElementById('userEmail').disabled = false;
        
        modal.show();
    }

    updatePagination(totalCount) {
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);
        const pagination = document.getElementById('usersPagination');
        
        if (!pagination || totalPages <= 1) {
            if (pagination) pagination.innerHTML = '';
            return;
        }

        let html = `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="usuariosAdmin.goToPage(${this.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
            </li>
        `;

        for (let i = 1; i <= totalPages; i++) {
            html += `
                <li class="page-item ${this.currentPage === i ? 'active' : ''}">
                    <button class="page-link" onclick="usuariosAdmin.goToPage(${i})">
                        ${i}
                    </button>
                </li>
            `;
        }

        html += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="usuariosAdmin.goToPage(${this.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </li>
        `;

        pagination.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadUsers();
        window.scrollTo(0, 0);
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

        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    showError(message) {
        this.showToast(message, 'danger');
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.usuariosAdmin = new UsuariosAdmin();
});

