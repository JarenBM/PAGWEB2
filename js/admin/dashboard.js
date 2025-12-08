// js/admin/dashboard.js
import { supabase } from '/js/supabaseClient.js'
import Auth from './js/auth.js'

class AdminDashboard {
    constructor() {
        this.init()
    }

    async init() {
        // 1. Verificar que sea admin
        if (!await Auth.isAdmin()) {
            window.location.href = '/Pages/auth/login.html'
            return
        }

        // 2. Cargar datos del dashboard
        await this.loadDashboard()
        
        // 3. Configurar eventos
        this.setupEvents()
        
        // 4. Actualizar cada 30 segundos
        setInterval(() => this.loadDashboard(), 30000)
    }

    async loadDashboard() {
        try {
            // Cargar en paralelo
            const [metrics, recentOrders, lowStock] = await Promise.all([
                this.getMetrics(),
                this.getRecentOrders(10),
                this.getLowStockProducts()
            ])

            this.updateMetrics(metrics)
            this.displayRecentOrders(recentOrders)
            this.displayLowStock(lowStock)
            
        } catch (error) {
            console.error('Error cargando dashboard:', error)
            this.showError('Error cargando datos')
        }
    }

    async getMetrics() {
        const today = new Date().toISOString().split('T')[0]
        
        const [{ count: pedidosHoy }, { data: ventasHoy }, { count: productosBajoStock }] = await Promise.all([
            supabase.from('orders').select('*', { count: 'exact', head: true })
                .gte('created_at', today),
            supabase.from('orders').select('total').gte('created_at', today),
            supabase.from('products').select('*', { count: 'exact', head: true })
                .lt('stock', 5).eq('is_active', true)
        ])

        return {
            pedidosHoy: pedidosHoy || 0,
            ventasHoy: ventasHoy?.reduce((sum, o) => sum + o.total, 0) || 0,
            productosBajoStock: productosBajoStock || 0
        }
    }

    async getRecentOrders(limit = 10) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                profiles(full_name, phone)
            `)
            .order('created_at', { ascending: false })
            .limit(limit)

        return error ? [] : data
    }

    async getLowStockProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .lt('stock', 5)
            .eq('is_active', true)
            .order('stock', { ascending: true })

        return error ? [] : data
    }

    updateMetrics(metrics) {
        document.getElementById('pedidosHoy').textContent = metrics.pedidosHoy
        document.getElementById('ventasHoy').textContent = `S/ ${metrics.ventasHoy.toFixed(2)}`
        document.getElementById('productosBajoStock').textContent = metrics.productosBajoStock
    }

    displayRecentOrders(orders) {
        const container = document.getElementById('recentOrdersTable')
        if (!orders.length) {
            container.innerHTML = '<p class="text-muted">No hay pedidos recientes</p>'
            return
        }

        const html = `
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>N° Pedido</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>${order.order_number}</td>
                            <td>${order.customer_name}</td>
                            <td>S/ ${order.total.toFixed(2)}</td>
                            <td>
                                <span class="badge ${this.getStatusClass(order.order_status)}">
                                    ${this.getStatusText(order.order_status)}
                                </span>
                            </td>
                            <td>
                                <a href="pedidos/detalle.html?id=${order.id}" 
                                   class="btn btn-sm btn-primary">
                                    <i class="fas fa-eye"></i>
                                </a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `

        container.innerHTML = html
    }

    displayLowStock(products) {
        const container = document.getElementById('lowStockProducts')
        if (!products.length) {
            container.innerHTML = '<p class="text-success">Todo el stock en niveles normales</p>'
            return
        }

        const html = `
            <div class="list-group">
                ${products.map(product => `
                    <div class="list-group-item list-group-item-warning">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${product.name}</strong>
                                <small class="text-muted d-block">Stock: ${product.stock} unidades</small>
                            </div>
                            <a href="productos/editar.html?id=${product.id}" 
                               class="btn btn-sm btn-primary">
                                Ajustar Stock
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `

        container.innerHTML = html
    }

    getStatusClass(status) {
        const classes = {
            'recibido': 'bg-secondary',
            'confirmado': 'bg-info',
            'en_preparacion': 'bg-warning',
            'listo': 'bg-primary',
            'en_camino': 'bg-dark',
            'entregado': 'bg-success',
            'cancelado': 'bg-danger'
        }
        return classes[status] || 'bg-secondary'
    }

    getStatusText(status) {
        const texts = {
            'recibido': 'Recibido',
            'confirmado': 'Confirmado',
            'en_preparacion': 'En preparación',
            'listo': 'Listo para entrega',
            'en_camino': 'En camino',
            'entregado': 'Entregado',
            'cancelado': 'Cancelado'
        }
        return texts[status] || status
    }

    setupEvents() {
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await Auth.logout()
        })

        // Actualizar manualmente
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            this.loadDashboard()
        })
    }

    showError(message) {
        // Mostrar toast o alerta
        console.error(message)
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard()
})