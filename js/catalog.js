/* MarquesCheck – catalog cache from mc_vendedores / mc_productos / mc_materiales */
(function (global) {
  const cache = {
    vendedores: [],
    productos: [],
    materiales: [],
    loaded: false
  };

  async function loadCatalogs(force) {
    if (cache.loaded && !force) return cache;
    const sb = MC.sb;

    const [vRes, pRes, mRes] = await Promise.all([
      sb.from('mc_vendedores').select('id,nombre,activo').order('nombre'),
      sb.from('mc_productos').select('id,nombre,unidades_por_paca,activo').order('nombre'),
      sb.from('mc_materiales').select('id,nombre,activo,orden').order('orden').order('nombre')
    ]);

    if (vRes.error) throw new Error(vRes.error.message);
    if (pRes.error) throw new Error(pRes.error.message);
    if (mRes.error) throw new Error(mRes.error.message);

    cache.vendedores = vRes.data || [];
    cache.productos = pRes.data || [];
    cache.materiales = mRes.data || [];
    cache.loaded = true;
    return cache;
  }

  function activeVendedores() {
    return cache.vendedores.filter(function (v) {
      return v.activo !== false;
    });
  }

  function activeProductos() {
    return cache.productos.filter(function (p) {
      return p.activo !== false;
    });
  }

  function activeMateriales() {
    return cache.materiales.filter(function (m) {
      return m.activo !== false;
    });
  }

  function fillVendorSelects(selectEls, placeholder) {
    placeholder = placeholder || 'Seleccione un vendedor';
    const opts =
      '<option value="" disabled selected>' +
      placeholder +
      '</option>' +
      activeVendedores()
        .map(function (v) {
          return '<option value="' + MC.escapeHtml(v.nombre) + '">' + MC.escapeHtml(v.nombre) + '</option>';
        })
        .join('');
    (Array.isArray(selectEls) ? selectEls : [selectEls]).forEach(function (el) {
      if (!el) return;
      const prev = el.value;
      el.innerHTML = opts;
      if (prev) {
        el.value = prev;
        if (!el.value) el.selectedIndex = 0;
      }
    });
  }

  function fillMaterialChips(container) {
    if (!container) return;
    container.innerHTML = activeMateriales()
      .map(function (m, i) {
        const id = 'mat_' + (m.id || i);
        const val = MC.escapeHtml(m.nombre);
        return (
          '<div><input type="checkbox" id="' +
          id +
          '" value="' +
          val +
          '" class="mat-check"><label for="' +
          id +
          '" class="px-4 py-2 border border-gray-200 rounded-full text-sm font-medium">' +
          val +
          '</label></div>'
        );
      })
      .join('');
  }

  function productOptionsHtml(selected) {
    selected = selected || '';
    return (
      '<option value="" disabled' +
      (!selected ? ' selected' : '') +
      '>Seleccione un producto</option>' +
      activeProductos()
        .map(function (p) {
          const n = MC.escapeHtml(p.nombre);
          return (
            '<option value="' +
            n +
            '"' +
            (p.nombre === selected ? ' selected' : '') +
            ' data-unidades="' +
            (p.unidades_por_paca || 24) +
            '">' +
            n +
            '</option>'
          );
        })
        .join('')
    );
  }

  function unidadesForProduct(nombre) {
    const p = cache.productos.find(function (x) {
      return x.nombre === nombre;
    });
    if (p && p.unidades_por_paca) return p.unidades_por_paca;
    return /2\.5/.test(nombre || '') ? 10 : 24;
  }

  function fillEstadoSelect(el) {
    if (!el) return;
    el.innerHTML =
      '<option value="" disabled selected>Seleccione un estado</option>' +
      MC.ESTADOS_VE.map(function (e) {
        const label = e === 'La Guaira' ? 'La Guaira (Vargas)' : e;
        return '<option value="' + e + '">' + label + '</option>';
      }).join('');
  }

  async function ensureVendor(nombre) {
    if (!nombre) return;
    const { error } = await MC.sb
      .from('mc_vendedores')
      .upsert([{ nombre: nombre, activo: true }], { onConflict: 'nombre' });
    if (error) throw new Error(error.message);
    const existing = cache.vendedores.find(function (v) {
      return v.nombre === nombre;
    });
    if (!existing) {
      cache.vendedores.push({ id: null, nombre: nombre, activo: true });
      cache.vendedores.sort(function (a, b) {
        return a.nombre.localeCompare(b.nombre);
      });
    } else {
      existing.activo = true;
    }
  }

  global.MC = global.MC || {};
  global.MC.catalog = {
    cache: cache,
    loadCatalogs: loadCatalogs,
    activeVendedores: activeVendedores,
    activeProductos: activeProductos,
    activeMateriales: activeMateriales,
    fillVendorSelects: fillVendorSelects,
    fillMaterialChips: fillMaterialChips,
    productOptionsHtml: productOptionsHtml,
    unidadesForProduct: unidadesForProduct,
    fillEstadoSelect: fillEstadoSelect,
    ensureVendor: ensureVendor
  };
})(window);
