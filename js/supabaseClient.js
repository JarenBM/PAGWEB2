// js/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm'

// REEMPLAZA CON TUS CREDENCIALES REALES
const SUPABASE_URL = 'https://lcmyotyuvuxmolqibyji.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbXlvdHl1dnV4bW9scWlieWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MDM1ODEsImV4cCI6MjA4MDM3OTU4MX0.BGmC6HwebIzGUpdCAY79RulOTfKs0rPrv1vlJCKGtrY'

// Crear cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ========== FUNCIONES DE AUTH ==========
export const auth = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  async register(email, password, userData) {
    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.full_name
        }
      }
    })

    if (authError) return { data: null, error: authError }

    // 2. Crear perfil en la tabla profiles
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: userData.full_name,
          phone: userData.phone,
          address: userData.address
        })

      if (profileError) {
        console.error('Error creando perfil:', profileError)
        return { data: null, error: profileError }
      }

      // 3. Asignar rol de cliente por defecto
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'cliente'
        })

      if (roleError) {
        console.error('Error asignando rol:', roleError)
      }
    }

    return { data: authData, error: null }
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser()
    return { data, error }
  },

  async getUserProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error obteniendo perfil:', error)
      return null
    }

    return data
  },

  async getUserRoles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error) {
      console.error('Error obteniendo roles:', error)
      return []
    }

    return data.map(item => item.role)
  },

  async hasRole(requiredRole) {
    const roles = await this.getUserRoles()
    return roles.includes(requiredRole)
  },

  async isAdmin() {
    return await this.hasRole('admin') || await this.hasRole('superadmin')
  },

  async redirectByRole() {
    const roles = await this.getUserRoles()
    
    if (roles.includes('admin') || roles.includes('superadmin')) {
      window.location.href = '/admin/dashboard.html'
    } else if (roles.includes('chef') || roles.includes('delivery')) {
      window.location.href = '/empleado/pedidos.html'
    } else {
      window.location.href = '/catalogo.html'
    }
  }
}