/* Dashboard auth – Supabase Auth (email) + optional mc_dashboard_users (username) */
(function (global) {
  const SESSION_KEY = 'mc_dash_session_v1';
  const USERS_TABLE = 'mc_dashboard_users';

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

  async function countUsers() {
    const { count, error } = await MC.sb
      .from(USERS_TABLE)
      .select('id', { count: 'exact', head: true });
    if (error) return { error: error, count: null };
    return { error: null, count: count || 0 };
  }

  async function listUsers() {
    const { data, error } = await MC.sb
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
      const { error } = await MC.sb.from(USERS_TABLE).update(payload).eq('id', row.id);
      if (error) throw new Error(error.message);
    } else {
      if (!payload.password_hash) throw new Error('Contraseña requerida');
      payload.created_at = new Date().toISOString();
      const { error } = await MC.sb.from(USERS_TABLE).insert([payload]);
      if (error) throw new Error(error.message);
    }
  }

  async function setUserActivo(id, activo) {
    const { error } = await MC.sb
      .from(USERS_TABLE)
      .update({ activo: !!activo, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function loginLocal(username, password) {
    const uname = String(username || '').trim().toLowerCase();
    const { data, error } = await MC.sb
      .from(USERS_TABLE)
      .select('id,username,password_hash,activo')
      .eq('username', uname)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.activo === false) return false;
    const ok = await verifyPassword(password, data.password_hash);
    if (!ok) return false;
    setSession({
      type: 'local',
      id: data.id,
      username: data.username,
      at: Date.now()
    });
    return true;
  }

  async function loginSupabase(email, password) {
    const { data, error } = await MC.sb.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: password
    });
    if (error) return { ok: false, message: error.message };
    setSession({
      type: 'supabase',
      email: data.user && data.user.email,
      at: Date.now()
    });
    return { ok: true };
  }

  async function login(identifier, password) {
    const id = String(identifier || '').trim();
    if (!id || !password) throw new Error('Usuario y contraseña requeridos');

    // Prefer local dashboard users when table is reachable
    try {
      const localOk = await loginLocal(id, password);
      if (localOk) return { ok: true, mode: 'local' };
    } catch (e) {
      // table may not exist yet — fall through to Supabase Auth
      if (!/relation|does not exist|42P01|PGRST/i.test(e.message || '')) {
        // still try supabase below
      }
    }

    if (id.indexOf('@') !== -1) {
      const r = await loginSupabase(id, password);
      if (r.ok) return { ok: true, mode: 'supabase' };
      throw new Error(r.message || 'Credenciales inválidas');
    }

    // Try supabase with username@... not applicable — fail
    throw new Error('Usuario o contraseña incorrectos');
  }

  async function logout() {
    clearSession();
    try { await MC.sb.auth.signOut(); } catch (e) { /* ignore */ }
  }

  async function ensureAuthenticated() {
    const sess = getSession();
    if (sess && sess.type === 'local' && sess.username) {
      const { data, error } = await MC.sb
        .from(USERS_TABLE)
        .select('id,username,activo')
        .eq('username', sess.username)
        .maybeSingle();
      if (!error && data && data.activo !== false) {
        return { ok: true, session: { type: 'local', username: data.username, id: data.id } };
      }
      clearSession();
    }

    const { data: { session } } = await MC.sb.auth.getSession();
    if (session && session.user) {
      setSession({ type: 'supabase', email: session.user.email, at: Date.now() });
      return { ok: true, session: { type: 'supabase', email: session.user.email } };
    }

    clearSession();
    return { ok: false, session: null };
  }

  async function bootstrapAdmin(username, password) {
    const c = await countUsers();
    if (c.error) throw new Error('Tabla mc_dashboard_users no disponible: ' + c.error.message);
    if (c.count > 0) throw new Error('Ya existen usuarios. Inicia sesión.');
    await upsertUser({ username: username, password: password, activo: true });
    return loginLocal(username, password);
  }

  global.MC = global.MC || {};
  global.MC.auth = {
    USERS_TABLE: USERS_TABLE,
    getSession: getSession,
    login: login,
    logout: logout,
    ensureAuthenticated: ensureAuthenticated,
    countUsers: countUsers,
    listUsers: listUsers,
    upsertUser: upsertUser,
    setUserActivo: setUserActivo,
    hashPassword: hashPassword,
    bootstrapAdmin: bootstrapAdmin
  };
})(window);
