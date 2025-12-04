// js/admin/dashboard.js
import { supabase } from './supabaseClient.js'
import Auth from '../auth.js'

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar que sea admin
  const isAdmin = await Auth.isAdmin()
  
  if (!isAdmin) {
    alert('Acceso denegado. Solo administradores pueden acceder.')
    window.location.href = '/pages/auth/login.html'
    return
  }

  // Cargar datos del dashboard
  await loadDashboardData()
  
  // Configurar logout
  setupLogout()
})

async function loadDashboardData() {
  try {
    // 1. Total pedidos hoy
    const today = new Date().toISOString().split('T')[0]
    const { count: pedidosHoy } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    if (document.getElementById('pedidosHoy')) {
      document.getElementById('pedidosHoy').textContent = pedidosHoy || 0
    }

    // 2. Ventas hoy
    const { data: ventasHoy } = await supabase
      .from('orders')
      .select('total')
      .gte('created_at', today)

    const totalVentas = ventasHoy?.reduce((sum, order) => sum + order.total, 0) || 0
    if (document.getElementById('ventasHoy')) {
      document.getElementById('ventasHoy').textContent = `S/ ${totalVentas.toFixed(2)}`
    }

    // 3. Productos con stock bajo
    const { data: productosBajoStock } = await supabase
      .from('products')
      .select('*')
      .lt('stock', 5)

    if (document.getElementById('stockBajo')) {
      document.getElementById('stockBajo').textContent = productosBajoStock?.length || 0
    }

    // 4. Total usuarios
    const { count: totalUsuarios } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (document.getElementById('totalUsuarios')) {
      document.getElementById('totalUsuarios').textContent = totalUsuarios || 0
    }

    // 5. Cargar últimos pedidos
    await loadRecentOrders()

  } catch (error) {
    console.error('Error cargando dashboard:', error)
  }
}

async function loadRecentOrders() {
  try {
    const { data: pedidos } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    const container = document.getElementById('ultimosPedidos')
    if (!container) return

    if (!pedidos || pedidos.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay pedidos recientes</p>'
      return
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${pedidos.map(order => `
              <tr>
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>S/ ${order.total.toFixed(2)}</td>
                <td>
                  <span class="badge bg-${getStatusColor(order.order_status)}">
                    ${order.order_status}
                  </span>
                </td>
                <td>${formatDate(order.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    container.innerHTML = html

  } catch (error) {
    console.error('Error cargando pedidos:', error)
    const container = document.getElementById('ultimosPedidos')
    if (container) {
      container.innerHTML = '<p class="text-danger">Error cargando pedidos</p>'
    }
  }
}

function getStatusColor(status) {
  const colors = {
    'pendiente': 'warning',
    'confirmado': 'info',
    'preparando': 'primary',
    'listo': 'success',
    'en_camino': 'dark',
    'entregado': 'success',
    'cancelado': 'danger'
  }
  return colors[status] || 'secondary'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      await Auth.logout()
    })
  }
}