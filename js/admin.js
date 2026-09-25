/* Admin: usuarios panel + usuarios gestión + catálogos + zonas */
(function (global) {
  let currentTab = 'usuarios';
  let usersCache = [];
  let gestionUsersCache = [];
  let rotatePick = null;

  const TAB_LABELS = {
    usuarios: 'usuario',
    usuarios_gestion: 'usuario de gestión',
    vendedores: 'vendedor',
    productos: 'producto',
    materiales: 'material',
    zonas: 'zona'
  };

  function isPanelUsersTab() {
    return currentTab === 'usuarios';
  }

  function isGestionUsersTab() {
    return currentTab === 'usuarios_gestion';
  }

  function isAnyUsersTab() {
    return isPanelUsersTab() || isGestionUsersTab();
  }

  function usersAuthApi() {
    return isGestionUsersTab() ? MC.gestionAuth : MC.auth;
  }

  function rowsFor(tab) {
    const c = MC.catalog.cache;
    if (tab === 'vendedores') return c.vendedores.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    if (tab === 'productos') return c.productos.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    if (tab === 'materiales') return c.materiales.slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre); });
    if (tab === 'zonas') return MC.zones ? MC.zones.activeZonas() : [];
    if (tab === 'usuarios_gestion') {
      return gestionUsersCache.slice().sort(function (a, b) {
        return String(a.username).localeCompare(String(b.username));
      });
    }
    return usersCache.slice().sort(function (a, b) { return String(a.username).localeCompare(String(b.username)); });
  }

  async function loadUsersForTab() {
    if (isGestionUsersTab()) {
      if (!MC.gestionAuth) throw new Error('MC.gestionAuth no cargado');
      gestionUsersCache = await MC.gestionAuth.listUsers();
      return;
    }
    if (isPanelUsersTab()) {
      usersCache = await MC.auth.listUsers();
    }
  }

  function usersTableHint(errMsg) {
    if (isGestionUsersTab()) {
      return /mc_gestion_users|42P01|does not exist/i.test(errMsg || '')
        ? 'Tabla mc_gestion_users no existe. Ejecuta sql/mc_gestion_users.sql en Supabase.'
        : errMsg;
    }
    return /mc_dashboard_users|42P01|does not exist/i.test(errMsg || '')
      ? 'Tabla mc_dashboard_users no existe. Ejecuta sql/mc_dashboard_users.sql en Supabase.'
      : errMsg;
  }

  function updateAddLabel() {
    const btn = document.getElementById('btnAdminAdd');
    if (!btn) return;
    if (currentTab === 'zonas') {
      btn.textContent = '+ Asignar vendedor a zona';
      btn.classList.remove('hidden');
    } else {
      btn.textContent = '+ Agregar ' + (TAB_LABELS[currentTab] || 'ítem');
      btn.classList.remove('hidden');
    }
  }

  function renderZonesPanel() {
    const list = document.getElementById('adminList');
    if (!list || !MC.zones) return;
    const zonas = MC.zones.activeZonas();
    const unassigned = MC.zones.unassignedVendors();

    let html = '';
    if (unassigned.length) {
      const zonaOpts = zonas
        .map(function (z) {
          return (
            '<option value="' + z.id + '">' + MC.escapeHtml(z.nombre) + '</option>'
          );
        })
        .join('');
      html +=
        '<div class="zona-unassigned mb-4">' +
        '<p class="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Sin zona (' +
        unassigned.length +
        ')</p>' +
        '<p class="text-[11px] text-amber-800/80 mb-3">Reubica cada ejecutivo eligiendo una zona.</p>' +
        unassigned
          .map(function (v) {
            return (
              '<div class="admin-row" data-vendedor="' +
              v.id +
              '">' +
              '<div class="admin-row-main"><div class="admin-name">' +
              MC.escapeHtml(v.nombre) +
              '</div><div class="admin-meta">sin zona asignada</div></div>' +
              '<div class="admin-row-actions zona-reubicar-actions">' +
              '<select class="input-base zona-reubicar-select" style="border-color:#fcd34d;min-width:140px">' +
              '<option value="">Elegir zona…</option>' +
              zonaOpts +
              '</select>' +
              '<button type="button" class="admin-btn ok" data-act="reubicar">Reubicar</button>' +
              '</div></div>'
            );
          })
          .join('') +
        '</div>';
    }

    if (!zonas.length) {
      html +=
        '<p class="text-sm text-gray-500 py-6 text-center">Sin zonas. Ejecuta <code>sql/mc_zonas.sql</code> en Supabase.</p>';
      list.innerHTML = html;
      return;
    }

    html += zonas
      .map(function (z) {
        const vendors = MC.zones.vendorsInZona(z.id);
        const rows = vendors.length
          ? vendors
              .map(function (v) {
                return (
                  '<div class="admin-row" data-assignment="' +
                  v.assignmentId +
                  '" data-zona="' +
                  z.id +
                  '" data-vendedor="' +
                  v.vendedorId +
                  '">' +
                  '<div class="admin-row-main"><div class="admin-name">' +
                  MC.escapeHtml(v.nombre) +
                  '</div>' +
                  '<div class="admin-meta">asignado' +
                  (v.assigned_at
                    ? ' · ' + MC.auth.formatCreated(v.assigned_at)
                    : '') +
                  '</div></div>' +
                  '<div class="admin-row-actions">' +
                  '<button type="button" class="admin-btn" data-act="move">Mover</button>' +
                  '<button type="button" class="admin-btn" data-act="rotate-pick">' +
                  (rotatePick && String(rotatePick) === String(v.assignmentId)
                    ? 'Seleccionado ✓'
                    : 'Rodar') +
                  '</button>' +
                  '<button type="button" class="admin-btn danger" data-act="unassign">Quitar</button>' +
                  '</div></div>'
                );
              })
              .join('')
          : '<p class="text-xs text-gray-400 px-1 py-2">Sin ejecutivos asignados</p>';

        return (
          '<div class="zona-block mb-4">' +
          '<div class="resumen-zona-head">' +
          '<h3>' +
          MC.escapeHtml(z.nombre) +
          '</h3>' +
          '<span>' +
          vendors.length +
          ' ejecutivo' +
          (vendors.length !== 1 ? 's' : '') +
          '</span></div>' +
          rows +
          '</div>'
        );
      })
      .join('');

    if (rotatePick) {
      html =
        '<div class="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">' +
        'Modo rodar: selecciona otro ejecutivo de <strong>otra zona</strong> para intercambiar.' +
        ' <button type="button" class="admin-btn" data-act="rotate-cancel">Cancelar</button></div>' +
        html;
    }

    list.innerHTML = html;
  }

  function renderList() {
    const list = document.getElementById('adminList');
    const note = document.getElementById('adminUsersNote');
    const noteGestion = document.getElementById('adminGestionUsersNote');
    if (note) note.classList.toggle('hidden', !isPanelUsersTab());
    if (noteGestion) noteGestion.classList.toggle('hidden', !isGestionUsersTab());
    updateAddLabel();
    if (!list) return;

    if (currentTab === 'zonas') {
      renderZonesPanel();
      return;
    }

    const rows = rowsFor(currentTab);
    if (!rows.length) {
      list.innerHTML =
        isPanelUsersTab()
          ? '<p class="text-sm text-gray-500 py-6 text-center">Sin usuarios del panel. Usa <strong>+ Agregar</strong> o el bootstrap en login si la tabla está vacía.</p>'
          : isGestionUsersTab()
            ? '<p class="text-sm text-gray-500 py-6 text-center">Sin usuarios de gestión. Usa <strong>+ Agregar</strong> o el bootstrap en <a class="text-brand-700 font-bold underline" href="gestion.html">gestion.html</a>.</p>'
            : '<p class="text-sm text-gray-500 py-6 text-center">Sin registros</p>';
      return;
    }
    if (isAnyUsersTab()) {
      const kind = isGestionUsersTab() ? 'gestión' : 'panel';
      const fmt = isGestionUsersTab() && MC.gestionAuth
        ? MC.gestionAuth.formatCreated
        : MC.auth.formatCreated;
      list.innerHTML = rows
        .map(function (r) {
          const inactive = r.activo === false;
          const created = fmt(r.created_at);
          const meta =
            (inactive ? 'inactivo' : 'activo') +
            (created ? ' · creado ' + created : '') +
            ' · ' + kind;
          return (
            '<div class="admin-row' +
            (inactive ? ' inactive' : '') +
            '" data-id="' +
            r.id +
            '">' +
            '<div class="admin-row-main"><div class="admin-name">' +
            MC.escapeHtml(r.username) +
            '</div>' +
            '<div class="admin-meta">' +
            MC.escapeHtml(meta) +
            '</div></div>' +
            '<div class="admin-row-actions">' +
            '<button type="button" class="admin-btn" data-act="edit" title="Editar / cambiar contraseña">Editar</button>' +
            (inactive
              ? '<button type="button" class="admin-btn ok" data-act="activate">Activar</button>'
              : '<button type="button" class="admin-btn danger" data-act="deactivate">Desactivar</button>') +
            '<button type="button" class="admin-btn danger" data-act="delete" title="Eliminar permanentemente">Eliminar</button>' +
            '</div></div>'
          );
        })
        .join('');
      return;
    }
    list.innerHTML = rows
      .map(function (r) {
        const inactive = r.activo === false;
        let meta = '';
        if (currentTab === 'productos') meta = (r.unidades_por_paca || 24) + ' und/paca';
        else if (currentTab === 'materiales') meta = 'orden ' + (r.orden != null ? r.orden : 0);
        else if (currentTab === 'vendedores' && MC.zones) {
          const z = MC.zones.zonaForVendorName(r.nombre);
          meta = z ? z.nombre : 'sin zona';
        }
        return (
          '<div class="admin-row' +
          (inactive ? ' inactive' : '') +
          '" data-id="' +
          r.id +
          '">' +
          '<div class="admin-row-main"><div class="admin-name">' +
          MC.escapeHtml(r.nombre) +
          '</div>' +
          (meta
            ? '<div class="admin-meta">' +
              MC.escapeHtml(meta) +
              (inactive ? ' · inactivo' : '') +
              '</div>'
            : inactive
              ? '<div class="admin-meta">inactivo</div>'
              : '') +
          '</div>' +
          '<div class="admin-row-actions">' +
          '<button type="button" class="admin-btn" data-act="edit">Editar</button>' +
          (inactive
            ? '<button type="button" class="admin-btn ok" data-act="activate">Activar</button>'
            : '<button type="button" class="admin-btn danger" data-act="deactivate">Desactivar</button>') +
          '</div></div>'
        );
      })
      .join('');
  }

  function showForm(mode, row) {
    const form = document.getElementById('adminForm');
    const title = document.getElementById('adminFormTitle');
    const extra = document.getElementById('adminExtraFields');
    const nombreLabel = document.getElementById('adminNombreLabel');
    const nombreInput = document.getElementById('adminNombre');
    document.getElementById('adminEditId').value = row && row.id ? row.id : '';
    title.textContent = mode === 'edit' ? 'Editar' : 'Agregar';

    if (currentTab === 'zonas') {
      title.textContent = 'Asignar vendedor a zona';
      nombreLabel.classList.add('hidden');
      nombreInput.classList.add('hidden');
      const zonas = MC.zones.activeZonas();
      const vendors = MC.zones.unassignedVendors().concat(
        (MC.catalog.cache.vendedores || []).filter(function (v) {
          return v.activo !== false;
        })
      );
      // unique by id
      const seen = {};
      const uniq = vendors.filter(function (v) {
        if (seen[v.id]) return false;
        seen[v.id] = true;
        return true;
      });
      extra.innerHTML =
        '<div class="mt-1"><label class="field-label">Zona</label>' +
        '<select id="adminZonaId" class="input-base" style="border-color:#e5e7eb">' +
        zonas
          .map(function (z) {
            return (
              '<option value="' + z.id + '">' + MC.escapeHtml(z.nombre) + '</option>'
            );
          })
          .join('') +
        '</select></div>' +
        '<div class="mt-3"><label class="field-label">Vendedor</label>' +
        '<select id="adminVendorId" class="input-base" style="border-color:#e5e7eb">' +
        uniq
          .map(function (v) {
            const z = MC.zones.zonaForVendorName(v.nombre);
            const label = v.nombre + (z ? ' (' + z.nombre + ')' : ' · sin zona');
            return (
              '<option value="' + v.id + '">' + MC.escapeHtml(label) + '</option>'
            );
          })
          .join('') +
        '</select></div>' +
        '<p class="text-[11px] text-gray-400 mt-2">Si ya tiene zona, se cierra la asignación anterior (historial conservado).</p>';
      form.classList.remove('hidden');
      return;
    }

    nombreLabel.classList.remove('hidden');
    nombreInput.classList.remove('hidden');

    if (isAnyUsersTab()) {
      nombreInput.value = row ? row.username : '';
      nombreInput.placeholder = isGestionUsersTab()
        ? 'usuario de gestión o correo'
        : 'usuario o correo@empresa.com';
      nombreLabel.textContent = 'Usuario / correo';
      extra.innerHTML =
        '<div class="mt-3"><label class="field-label">Contraseña' +
        (mode === 'edit'
          ? ' <span class="field-sub">(dejar vacío para no cambiar)</span>'
          : '') +
        '</label><input type="password" id="adminPassword" class="input-base" style="border-color:#e5e7eb" autocomplete="new-password" minlength="4"></div>' +
        '<p class="text-[11px] text-gray-400 mt-2">Se guarda con hash (sha256$salt$hex). Nunca en texto plano.' +
        (isGestionUsersTab()
          ? ' Acceso solo a <code>gestion.html</code>.'
          : '') +
        '</p>';
    } else {
      nombreInput.value = row ? row.nombre : '';
      nombreInput.placeholder = 'Nombre';
      nombreLabel.textContent = 'Nombre';
      if (currentTab === 'productos') {
        extra.innerHTML =
          '<div class="mt-3"><label class="field-label">Unidades por paca</label><input type="number" id="adminUnidades" class="input-base" style="border-color:#e5e7eb" min="1" value="' +
          (row && row.unidades_por_paca ? row.unidades_por_paca : 24) +
          '"></div>';
      } else if (currentTab === 'materiales') {
        extra.innerHTML =
          '<div class="mt-3"><label class="field-label">Orden</label><input type="number" id="adminOrden" class="input-base" style="border-color:#e5e7eb" min="0" value="' +
          (row && row.orden != null ? row.orden : 0) +
          '"></div>';
      } else {
        extra.innerHTML = '';
      }
    }
    form.classList.remove('hidden');
  }

  function hideForm() {
    const form = document.getElementById('adminForm');
    if (form) form.classList.add('hidden');
    const nombreInput = document.getElementById('adminNombre');
    const nombreLabel = document.getElementById('adminNombreLabel');
    if (nombreInput) nombreInput.classList.remove('hidden');
    if (nombreLabel) nombreLabel.classList.remove('hidden');
  }

  async function saveForm() {
    const id = document.getElementById('adminEditId').value;

    if (currentTab === 'zonas') {
      const zonaId = (document.getElementById('adminZonaId') || {}).value;
      const vendorId = (document.getElementById('adminVendorId') || {}).value;
      if (!zonaId || !vendorId) return MC.showToast('Zona y vendedor requeridos.', 'error');
      MC.setLoading(true, 'Asignando…');
      try {
        await MC.zones.assignVendor(zonaId, vendorId, 'admin');
        hideForm();
        renderList();
        MC.setLoading(false);
        MC.showToast('Vendedor asignado.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
      return;
    }

    if (isAnyUsersTab()) {
      const username = document.getElementById('adminNombre').value.trim();
      const password = (document.getElementById('adminPassword') || {}).value || '';
      if (!username) return MC.showToast('Usuario requerido.', 'error');
      if (!id && !password) return MC.showToast('Contraseña requerida.', 'error');
      MC.setLoading(true, 'Guardando usuario…');
      try {
        await usersAuthApi().upsertUser({
          id: id || null,
          username: username,
          password: password || null,
          activo: true
        });
        await loadUsersForTab();
        hideForm();
        renderList();
        MC.setLoading(false);
        MC.showToast('Usuario guardado.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(usersTableHint(e.message), 'error');
      }
      return;
    }

    const nombre = document.getElementById('adminNombre').value.trim();
    if (!nombre) return MC.showToast('Nombre requerido.', 'error');
    const table =
      currentTab === 'vendedores'
        ? 'mc_vendedores'
        : currentTab === 'productos'
          ? 'mc_productos'
          : 'mc_materiales';
    const payload = { nombre: nombre, activo: true };
    if (currentTab === 'productos') {
      payload.unidades_por_paca =
        parseInt(document.getElementById('adminUnidades').value, 10) || 24;
      payload.updated_at = new Date().toISOString();
    }
    if (currentTab === 'materiales')
      payload.orden = parseInt(document.getElementById('adminOrden').value, 10) || 0;
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
    if (isAnyUsersTab()) {
      MC.setLoading(true, activo ? 'Activando…' : 'Desactivando…');
      try {
        await usersAuthApi().setUserActivo(id, activo);
        await loadUsersForTab();
        renderList();
        MC.setLoading(false);
        MC.showToast(activo ? 'Activado.' : 'Desactivado.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(usersTableHint(e.message), 'error');
      }
      return;
    }
    const table =
      currentTab === 'vendedores'
        ? 'mc_vendedores'
        : currentTab === 'productos'
          ? 'mc_productos'
          : 'mc_materiales';
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
    if (
      !confirm(
        '¿Eliminar permanentemente a "' +
          username +
          '"? Preferible desactivar si solo deja de aplicar.'
      )
    )
      return;
    MC.setLoading(true, 'Eliminando…');
    try {
      await usersAuthApi().deleteUser(id);
      await loadUsersForTab();
      renderList();
      MC.setLoading(false);
      MC.showToast('Usuario eliminado.', 'success');
    } catch (e) {
      MC.setLoading(false);
      MC.showToast(usersTableHint(e.message), 'error');
    }
  }

  async function handleZoneAction(act, rowEl) {
    if (act === 'rotate-cancel') {
      rotatePick = null;
      renderList();
      return;
    }
    const assignmentId = rowEl && rowEl.dataset.assignment;
    if (act === 'rotate-pick') {
      if (!assignmentId) return;
      if (!rotatePick) {
        rotatePick = assignmentId;
        renderList();
        return;
      }
      if (String(rotatePick) === String(assignmentId)) {
        rotatePick = null;
        renderList();
        return;
      }
      MC.setLoading(true, 'Rotando zonas…');
      try {
        await MC.zones.rotateVendors(rotatePick, assignmentId);
        rotatePick = null;
        renderList();
        MC.setLoading(false);
        MC.showToast('Ejecutivos rotados.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
      return;
    }
    if (act === 'unassign') {
      if (!confirm('¿Quitar este ejecutivo de la zona?')) return;
      MC.setLoading(true, 'Quitando…');
      try {
        await MC.zones.deactivateAssignment(assignmentId, 'admin-quitar');
        renderList();
        MC.setLoading(false);
        MC.showToast('Quitado de la zona.', 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
      return;
    }
    if (act === 'move') {
      const zonas = MC.zones.activeZonas().filter(function (z) {
        return String(z.id) !== String(rowEl.dataset.zona);
      });
      if (!zonas.length) return MC.showToast('No hay otras zonas.', 'error');
      const options = zonas
        .map(function (z, i) {
          return i + 1 + ') ' + z.nombre;
        })
        .join('\n');
      const pick = prompt('Mover a zona:\n' + options + '\n\nEscribe el número:');
      const idx = parseInt(pick, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= zonas.length) return;
      MC.setLoading(true, 'Moviendo…');
      try {
        await MC.zones.moveVendor(assignmentId, zonas[idx].id);
        renderList();
        MC.setLoading(false);
        MC.showToast('Movido a ' + zonas[idx].nombre, 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
      return;
    }
    if (act === 'reubicar') {
      const vendorId = rowEl && rowEl.dataset.vendedor;
      const sel = rowEl && rowEl.querySelector('.zona-reubicar-select');
      const zonaId = sel && sel.value;
      if (!vendorId) return;
      if (!zonaId) return MC.showToast('Elige una zona.', 'error');
      const z = MC.zones.activeZonas().find(function (x) {
        return String(x.id) === String(zonaId);
      });
      MC.setLoading(true, 'Reubicando…');
      try {
        await MC.zones.assignVendor(zonaId, vendorId, 'reubicar');
        await MC.zones.load(true);
        renderList();
        MC.setLoading(false);
        MC.showToast('Reubicado en ' + (z ? z.nombre : 'zona'), 'success');
      } catch (e) {
        MC.setLoading(false);
        MC.showToast(e.message, 'error');
      }
    }
  }

  let inited = false;

  function initAdmin() {
    if (inited) {
      refreshAdmin();
      return;
    }
    inited = true;
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        currentTab = btn.dataset.tab;
        document.querySelectorAll('.admin-tab').forEach(function (b) {
          b.classList.toggle('activo', b === btn);
        });
        hideForm();
        rotatePick = null;
        if (isAnyUsersTab()) {
          try {
            await loadUsersForTab();
          } catch (e) {
            if (isGestionUsersTab()) gestionUsersCache = [];
            else usersCache = [];
            MC.showToast(usersTableHint(e.message) || e.message, 'error');
          }
        }
        if (currentTab === 'zonas') {
          try {
            await MC.zones.load(true);
          } catch (e) {
            MC.showToast(
              /42P01|does not exist/i.test(e.message || '')
                ? 'Falta mc_zonas. Ejecuta sql/mc_zonas.sql en Supabase.'
                : e.message,
              'error'
            );
          }
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
        const act = btn.dataset.act;
        if (currentTab === 'zonas') {
          handleZoneAction(act, btn.closest('.admin-row') || btn.closest('.zona-block'));
          return;
        }
        const rowEl = btn.closest('.admin-row');
        const id = rowEl && rowEl.dataset.id;
        const row = rowsFor(currentTab).find(function (r) {
          return String(r.id) === String(id);
        });
        if (!row) return;
        if (act === 'edit') showForm('edit', row);
        if (act === 'deactivate') setActivo(id, false);
        if (act === 'activate') setActivo(id, true);
        if (act === 'delete' && isAnyUsersTab()) removeUser(id, row.username);
      });
    }
  }

  async function refreshAdmin() {
    if (isAnyUsersTab()) {
      try {
        await loadUsersForTab();
      } catch (e) {
        if (isGestionUsersTab()) gestionUsersCache = [];
        else usersCache = [];
      }
    }
    if (currentTab === 'zonas' || currentTab === 'vendedores') {
      try {
        if (MC.zones) await MC.zones.load(true);
      } catch (e) { /* ignore */ }
    }
    renderList();
  }

  async function openTab(tab) {
    currentTab = tab || 'usuarios';
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.tab === currentTab);
    });
    hideForm();
    rotatePick = null;
    if (isAnyUsersTab()) {
      try {
        await loadUsersForTab();
      } catch (e) {
        if (isGestionUsersTab()) gestionUsersCache = [];
        else usersCache = [];
      }
    }
    if (currentTab === 'zonas') {
      try {
        await MC.zones.load(true);
      } catch (e) { /* ignore */ }
    }
    renderList();
  }

  global.MC = global.MC || {};
  global.MC.admin = { init: initAdmin, refresh: refreshAdmin, openTab: openTab };
})(window);
