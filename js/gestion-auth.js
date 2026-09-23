/* Gestión auth – mc_gestion_users (sesión aparte del panel reconocimiento) */
(function (global) {
  const SESSION_KEY = 'mc_gestion_session_v1';
  const USERS_TABLE = 'mc_gestion_users';

  function getSb() {
    if (global.MC && global.MC.sb) return global.MC.sb;
    throw new Error('Cliente Supabase no inicializado (MC.sb)');
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(obj) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  /** Format: sha256$<salt>$<hex> */
  async function hashPassword(password, salt) {
    salt = salt || Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
    const hex = await sha256Hex(salt + ':' + password);
    return 'sha256$' + salt + '$' + hex;
  }

  async function verifyPassword(password, stored) {
    if (!stored || !password) return false;
    const parts = String(stored).split('$');
    if (parts.length === 3 && parts[0] === 'sha256') {
      const salt = parts[1];
      const expect = parts[2];
      const hex = await sha256Hex(salt + ':' + password);
      return hex === expect;
    }
    return false;
  }

  function formatCreated(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  async function countUsers() {
    const { count, error } = await getSb()
      .from(USERS_TABLE)
      .select('id', { count: 'exact', head: true });
    if (error) return { error: error, count: null };
    return { error: null, count: count || 0 };
  }

  async function listUsers() {
    const { data, error } = await getSb()
      .from(USERS_TABLE)
      .select('id,username,activo,created_at,updated_at')
      .order('username');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function upsertUser(row) {
    const payload = {
      username: String(row.username || '').trim().toLowerCase(),
      activo: row.activo !== false,
      updated_at: new Date().toISOString()
    };
    if (!payload.username) throw new Error('Usuario requerido');
    if (row.password) {
      if (String(row.password).length < 4) throw new Error('Contraseña mínimo 4 caracteres');
      payload.password_hash = await hashPassword(row.password);
    }
    if (row.id) {
      if (!row.password) delete payload.password_hash;
      const { error } = await getSb().from(USERS_TABLE).update(payload).eq('id', row.id);
      if (error) throw new Error(error.message);
    } else {
      if (!payload.password_hash) throw new Error('Contraseña requerida');
      payload.created_at = new Date().toISOString();
      const { error } = await getSb().from(USERS_TABLE).insert([payload]);
      if (error) throw new Error(error.message);
    }
  }

  async function setUserActivo(id, activo) {
    const { error } = await getSb()
      .from(USERS_TABLE)
      .update({ activo: !!activo, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function deleteUser(id) {
    const { error } = await getSb().from(USERS_TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function login(username, password) {
    const uname = String(username || '').trim().toLowerCase();
    if (!uname || !password) throw new Error('Usuario y contraseña requeridos');
    const { data, error } = await getSb()
      .from(USERS_TABLE)
      .select('id,username,password_hash,activo')
      .eq('username', uname)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.activo === false) throw new Error('Usuario o contraseña incorrectos');
    const ok = await verifyPassword(password, data.password_hash);
    if (!ok) throw new Error('Usuario o contraseña incorrectos');
    setSession({
      type: 'gestion',
      id: data.id,
      username: data.username,
      at: Date.now()
    });
    return { ok: true, session: getSession() };
  }

  async function logout() {
    clearSession();
  }

  async function ensureAuthenticated() {
    const sess = getSession();
    if (sess && sess.type === 'gestion' && sess.username) {
      const { data, error } = await getSb()
        .from(USERS_TABLE)
        .select('id,username,activo')
        .eq('username', sess.username)
        .maybeSingle();
      if (!error && data && data.activo !== false) {
        return { ok: true, session: { type: 'gestion', username: data.username, id: data.id } };
      }
    }
    clearSession();
    return { ok: false, session: null };
  }

  async function bootstrapAdmin(username, password) {
    const c = await countUsers();
    if (c.error) throw new Error('Tabla mc_gestion_users no disponible: ' + c.error.message);
    if (c.count > 0) throw new Error('Ya existen usuarios de gestión. Inicia sesión.');
    await upsertUser({ username: username, password: password, activo: true });
    return login(username, password);
  }

  global.MC = global.MC || {};
  global.MC.gestionAuth = {
    SESSION_KEY: SESSION_KEY,
    USERS_TABLE: USERS_TABLE,
    getSession: getSession,
    login: login,
    logout: logout,
    ensureAuthenticated: ensureAuthenticated,
    countUsers: countUsers,
    listUsers: listUsers,
    upsertUser: upsertUser,
    setUserActivo: setUserActivo,
    deleteUser: deleteUser,
    hashPassword: hashPassword,
    bootstrapAdmin: bootstrapAdmin,
    formatCreated: formatCreated
  };
})(window);
