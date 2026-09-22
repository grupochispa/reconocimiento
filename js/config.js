/* MarquesCheck – Supabase client & shared helpers */
(function (global) {
  const SUPABASE_URL = 'https://zgbsrbjtjnozpzxifpua.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYnNyYmp0am5venB6eGlmcHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNjI5MjUsImV4cCI6MjA2OTkzODkyNX0.zHVKe6Ab73PFhQqD3Au94x1Z71hMyRpxE1PCWP8-QTI';

  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const ESTADOS_VE = [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
    'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'Lara',
    'La Guaira', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa',
    'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'
  ];

  function r2(v) {
    return Math.round(v * 100) / 100;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setLoading(show, texto) {
    const loadingModal = document.getElementById('loadingModal');
    const loadingStatus = document.getElementById('loadingStatus');
    const btnSubmit = document.getElementById('btnSubmit');
    if (show) {
      loadingModal.classList.add('activo');
      if (loadingStatus) loadingStatus.textContent = texto || 'Procesando...';
      if (btnSubmit) btnSubmit.disabled = true;
    } else {
      loadingModal.classList.remove('activo');
      if (btnSubmit) btnSubmit.disabled = false;
      if (loadingStatus) loadingStatus.textContent = 'Iniciando';
    }
  }

  function showToast(message, type) {
    type = type || 'error';
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    document.getElementById('toastIconSuccess').classList.toggle('hidden', type !== 'success');
    document.getElementById('toastIconError').classList.toggle('hidden', type !== 'error');
    toast.classList.remove('-translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(function () {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-24', 'opacity-0');
    }, 3500);
  }

  async function uploadEvidencia(file, prefix) {
    prefix = prefix || 'ev';
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fname =
      prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    const { data: st, error: stErr } = await sb.storage
      .from('evidencias')
      .upload(fname, file, { cacheControl: '3600', upsert: false });
    if (stErr) throw new Error(stErr.message);
    const {
      data: { publicUrl }
    } = sb.storage.from('evidencias').getPublicUrl(st.path);
    return publicUrl;
  }

  global.MC = global.MC || {};
  global.MC.sb = sb;
  global.MC.ESTADOS_VE = ESTADOS_VE;
  global.MC.r2 = r2;
  global.MC.escapeHtml = escapeHtml;
  global.MC.setLoading = setLoading;
  global.MC.showToast = showToast;
  global.MC.uploadEvidencia = uploadEvidencia;
})(window);
