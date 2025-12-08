// js/auth.js
import { supabase } from "./supabaseClient.js";


const Auth = {
  // Verificar si está autenticado
  async isAuthenticated() {
    const { data: { user } } = await supabase.auth.getUser()
    return !!user
  },

  // Obtener usuario actual
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Obtener perfil completo
  async getProfile() {
    const user = await this.getCurrentUser()
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

  // Obtener roles del usuario
  async getRoles() {
    const user = await this.getCurrentUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error obteniendo roles:', error)
      return []
    }

    return data.map(item => item.role)
  },

  // Verificar si tiene un rol específico
  async hasRole(role) {
    const roles = await this.getRoles()
    return roles.includes(role)
  },

  // Verificar si es admin
  async isAdmin() {
    return await this.hasRole('admin') || await this.hasRole('superadmin')
  },

  // Login
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    return { data, error }
  },

  // Registro
  async register(email, password, userData) {
    // 1. Crear en Auth
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

    // 2. Crear perfil
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: userData.full_name,
          phone: userData.phone || '',
          address: userData.address || ''
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

  // Logout
  async logout() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      window.location.href = '/index.html'
    }
    return { error }
  },

  // Redirigir según rol
  async redirectByRole() {
    const isAdmin = await this.isAdmin()
    
    if (isAdmin) {
      window.location.href = '/Pages/admin/dashboard.html'
    } else {
      window.location.href = '/carrito.html'
    }
  }
}

export default Auth