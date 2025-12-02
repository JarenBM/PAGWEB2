// js/supabaseClient.js
// Inicializa el cliente Supabase y expone la variable global `supabase`.

const SUPABASE_URL = "https://ojmswyjitklnuhrsoqrl.supabase.co"
 // <-- reemplaza
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbXN3eWppdGtsbnVocnNvcXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NDc2MTAsImV4cCI6MjA4MDIyMzYxMH0.6eFsFghvPCcQjzWoSB36CDrGMLBSmwiKH5Lh_yy8xsc ";         // <-- reemplaza

// Si usas la versión 2.x:
const { createClient } = supabaseJs || window.supabase || { createClient: window.createClient }; 
// (la linea anterior es por si la lib está cargada globalmente desde CDN)

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Opcional: helper para obtener el perfil del usuario (por conveniencia)
window.getPerfil = async () => {
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await window.supabase
    .from("perfiles")
    .select("rol, nombres, apellidos, telefono")
    .eq("id", user.id)
    .single();
  return perfil;
};
