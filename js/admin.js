/* Admin: catalogos mc_* + usuarios del dashboard (mc_dashboard_users) */
(function (global) {
  let currentTab = 'usuarios';
  let usersCache = [];

  function rowsFor(tab) {
    const c = MC.catalog.cache;
    if (tab === 'vendedores') return c.vendedores.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    if (tab === 'productos') return c.productos.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    if (tab === 'materiales') return c.materiales.slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre); });
    return usersCache.slice().sort(function (a, b) { return String(a.username).localeCompare(String(b.username)); });
  }

  function renderList() {
    const list = document.getElementById('adminList');
    const note = document.getElementById('adminUsersNote');
    if (note) note.classList.toggle('hidden', currentTab !== 'usuarios');
    if (!list) return;
    const rows = rowsFor(currentTab);
    if (!rows.length) {
      list.innerHTML = currentTab === 'usuarios'
        ? '<p class="text-sm text-gray-500 py-6 text-center">Sin usuarios del panel. Usa <strong>+ Agregar</strong> o el bootstrap en login si la tabla está vacía.</p>'
        : '<p class="text-sm text-gray-500 py-6 text-center">Sin registros</p>';
      return;
    }
    if (currentTab === 'usuarios') {
      list.innerHTML = rows.map(function (r) {
        const inactive = r.activo === false;
        const created = MC.auth.formatCreated(r.created_at);
        const meta = (inactive ? 'inactivo' : 'activo') + (created ? ' · creado ' + created : '') + ' · panel';
        return (
          '<div class="admin-row' + (inactive ? ' inactive' : '') + '" data-id="' + r.id + '">' +
          '<div class="admin-row-main"><div class="admin-name">' + MC.escapeHtml(r.username) + '</div>' +
          '<div class="admin-meta">' + MC.escapeHtml(meta) + '</div></div>' +
          '<div class="admin-row-actions">' +
          '<button type="button" class="admin-btn" data-act="edit" title="Editar / cambiar contraseña">Editar</button>' +
          (inactive
            ? '<button type="button" class="admin-btn ok" data-act="activate">Activar</button>'
            : '<button type="button" class="admin-btn danger" data-act="deactivate">Desactivar</button>') +
          '<button type="button" class="admin-btn danger" data-act="delete" title="Eliminar permanentemente">Eliminar</button>' +
          '</div></div>'
        );
      }).join('');
      return;
    }
    list.innerHTML = rows.map(function (r) {
      const inactive = r.activo === false;
      const meta = currentTab === 'productos'
        ? (r.unidades_por_paca || 24) + ' und/paca'
        : currentTab === 'materiales'
          ? 'orden ' + (r.orden != null ? r.orden : 0)
          : '';
      return (
        '<div class="admin-row' + (inactive ? ' inactive' : '') + '" data-id="' + r.id + '">' +
        '<div class="admin-row-main"><div class="admin-name">' + MC.escapeHtml(r.nombre) + '</div>' +
        (meta ? '<div class="admin-meta">' + MC.escapeHtml(meta) + (inactive ? ' · inactivo' : '') + '</div>' : (inactive ? '<div class="admin-meta">inactivo</div>' : '')) +
        '</div>' +
        '<div class="admin-row-actions">' +
        '<button type="button" class="admin-btn" data-act="edit">Editar</button>' +
        (inactive
          ? '<button type="button" class="admin-btn ok" data-act="activate">Activar</button>'
          : '<button type="button" class="admin-btn danger" data-act="deactivate">Desactivar</button>') +
        '</div></div>'
      );
    }).join('');
  }

  function showForm(mode, row) {
    const form = document.getElementById('adminForm');
    const title = document.getElementById('adminFormTitle');
    const extra = document.getElementById('adminExtraFields');
    document.getElementById('adminEditId').value = row && row.id ? row.id : '';
    title.textContent = mode === 'edit' ? 'Editar' : 'Agregar';
    if (currentTab === 'usuarios') {
      document.getElementById('adminNombre').value = row ? row.username : '';
      document.getElementById('adminNombre').placeholder = 'usuario o correo@empresa.com';
      extra.innerHTML =
        '<div class="mt-3"><label class="field-label">Contraseña' +
        (mode === 'edit' ? ' <span class="field-sub">(dejar vacío para no cambiar)</span>' : '') +
        '</label><input type="password" id="adminPassword" class="input-base" style="border-color:#e5e7eb" autocomplete="new-password" minlength="4"></div>' +
        '<p class="text-[11px] text-gray-400 mt-2">Se guarda con hash (sha256$salt$hex). Nunca en texto plano.</p>';
    } else {
      document.getElementById('adminNombre').value = row ? row.nombre : '';
      document.getElementById('adminNombre').placeholder = 'Nombre';
      if (currentTab === 'productos') {
        extra.innerHTML = '<div class="mt-3"><label class="field-label">Unidades por paca</label><input type="number" id="adminUnidades" class="input-base" style="border-color:#e5e7eb" min="1" value="' + (row && row.unidades_por_paca ? row.unidades_por_paca : 24) + '"></div>';
      } else if (currentTab === 'materiales') {
        extra.innerHTML = '<div class="mt-3"><label class="field-label">Orden</label><input type="number" id="adminOrden" class="input-base" style="border-color:#e5e7eb" min="0" value="' + (row && row.orden != null ? row.orden : 0) + '"></div>';
      } else {
        extra.innerHTML = '';
      }
    }
    form.classList.remove('hidden');
  }

  function hideForm() {
    const form = document.getElementById('adminForm');
    if (form) form.classList.add('hidden');
  }

  async function saveForm() {
    const id = document.getElementById('adminEditId').value;
    if (currentTab === 'usuarios') {
      const username = document.getElementById('adminNombre').value.trim();
      const password = (document.getElementById('adminPassword') || {}).value || '';
      if (!username) return MC.showToast('Usuario requerido.', 'error');
      if (!id && !password) return MC.showToast('Contraseña requerida.', 'error');
      MC.setLoading(true, 'Guardando usuario…');
      try {
        await MC.auth.upsertUser({ id: id || null, username: username, password: password || null, activo: true });
        usersCache = await MC.auth.listUsers();
        hideForm();
        renderList();
        MC.setLoading(false);
        MC.showToast('Usuario guardado.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
      return;
    }
    const nombre = document.getElementById('adminNombre').value.trim();
    if (!nombre) return MC.showToast('Nombre requerido.', 'error');
    const table = currentTab === 'vendedores' ? 'mc_vendedores' : currentTab === 'productos' ? 'mc_productos' : 'mc_materiales';
    const payload = { nombre: nombre, activo: true };
    if (currentTab === 'productos') {
      payload.unidades_por_paca = parseInt(document.getElementById('adminUnidades').value, 10) || 24;
      payload.updated_at = new Date().toISOString();
    }
    if (currentTab === 'materiales') payload.orden = parseInt(document.getElementById('adminOrden').value, 10) || 0;
    if (currentTab === 'vendedores' && id) payload.updated_at = new Date().toISOString();
    MC.setLoading(true, 'Guardando…');
    try {
      let error;
      if (id) ({ error } = await MC.sb.from(table).update(payload).eq('id', id));
      else ({ error } = await MC.sb.from(table).insert([payload]));
      if (error) throw new Error(error.message);
      await MC.catalog.loadCatalogs(true);
      hideForm();
      renderList();
      MC.setLoading(false);
      MC.showToast('Guardado.', 'success');
    } catch (e) {
      MC.setLoading(false);
      MC.showToast(e.message, 'error');
    }
  }

  async function setActivo(id, activo) {
    if (currentTab === 'usuarios') {
      MC.setLoading(true, activo ? 'Activando…' : 'Desactivando…');
      try {
        await MC.auth.setUserActivo(id, activo);
        usersCache = await MC.auth.listUsers();
        renderList();
        MC.setLoading(false);
        MC.showToast(activo ? 'Activado.' : 'Desactivado.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
      return;
    }
    const table = currentTab === 'vendedores' ? 'mc_vendedores' : currentTab === 'productos' ? 'mc_productos' : 'mc_materiales';
    const payload = { activo: activo };
    if (currentTab !== 'materiales') payload.updated_at = new Date().toISOString();
    MC.setLoading(true, activo ? 'Activando…' : 'Desactivando…');
    try {
      const { error } = await MC.sb.from(table).update(payload).eq('id', id);
      if (error) throw new Error(error.message);
      await MC.catalog.loadCatalogs(true);
      renderList();
      MC.setLoading(false);
      MC.showToast(activo ? 'Activado.' : 'Desactivado.', 'success');
    } catch (e) {
      MC.setLoading(false);
      MC.showToast(e.message, 'error');
    }
  }

  async function removeUser(id, username) {
    if (!confirm('¿Eliminar permanentemente a "' + username + '"? Preferible desactivar si solo deja de aplicar.')) return;
    MC.setLoading(true, 'Eliminando…');
    try {
      await MC.auth.deleteUser(id);
      usersCache = await MC.auth.listUsers();
      renderList();
      MC.setLoading(false);
      MC.showToast('Usuario eliminado.', 'success');
    } catch (e) {
      MC.setLoading(false);
      MC.showToast(e.message, 'error');
    }
  }

  function initAdmin() {
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        currentTab = btn.dataset.tab;
        document.querySelectorAll('.admin-tab').forEach(function (b) { b.classList.toggle('activo', b === btn); });
        hideForm();
        if (currentTab === 'usuarios') {
          try { usersCache = await MC.auth.listUsers(); } catch (e) { usersCache = []; MC.showToast(e.message, 'error'); }
        }
        renderList();
      });
    });
    const btnAdd = document.getElementById('btnAdminAdd');
    if (btnAdd) btnAdd.addEventListener('click', function () { showForm('add', null); });
    const btnCancel = document.getElementById('btnAdminCancel');
    if (btnCancel) btnCancel.addEventListener('click', hideForm);
    const btnSave = document.getElementById('btnAdminSave');
    if (btnSave) btnSave.addEventListener('click', saveForm);
    const list = document.getElementById('adminList');
    if (list && !list.dataset.bound) {
      list.dataset.bound = '1';
      list.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const rowEl = btn.closest('.admin-row');
        const id = rowEl && rowEl.dataset.id;
        const row = rowsFor(currentTab).find(function (r) { return String(r.id) === String(id); });
        if (!row) return;
        if (btn.dataset.act === 'edit') showForm('edit', row);
        if (btn.dataset.act === 'deactivate') setActivo(id, false);
        if (btn.dataset.act === 'activate') setActivo(id, true);
        if (btn.dataset.act === 'delete' && currentTab === 'usuarios') removeUser(id, row.username);
      });
    }
  }

  async function refreshAdmin() {
    if (currentTab === 'usuarios') {
      try { usersCache = await MC.auth.listUsers(); } catch (e) { usersCache = []; }
    }
    renderList();
  }

  global.MC = global.MC || {};
  global.MC.admin = { init: initAdmin, refresh: refreshAdmin };
})(window);
