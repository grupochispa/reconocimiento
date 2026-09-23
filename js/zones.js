/* Zonas comerciales + asignaciones vendedor↔zona */
(function (global) {
  const cache = {
    zonas: [],
    assignments: [],
    loaded: false
  };

  function norm(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  async function loadZones(force) {
    if (cache.loaded && !force) return cache;
    const [zRes, aRes] = await Promise.all([
      MC.sb.from('mc_zonas').select('id,codigo,nombre,orden,activo').order('orden'),
      MC.sb
        .from('mc_zona_vendedores')
        .select('id,zona_id,vendedor_id,activo,assigned_at,unassigned_at,notas,mc_vendedores(id,nombre,activo)')
        .eq('activo', true)
    ]);
    if (zRes.error) throw new Error(zRes.error.message);
    if (aRes.error) throw new Error(aRes.error.message);
    cache.zonas = zRes.data || [];
    cache.assignments = aRes.data || [];
    cache.loaded = true;
    return cache;
  }

  function activeZonas() {
    return cache.zonas.filter(function (z) {
      return z.activo !== false;
    });
  }

  function vendorsInZona(zonaId) {
    return cache.assignments
      .filter(function (a) {
        return a.zona_id === zonaId && a.activo !== false;
      })
      .map(function (a) {
        return {
          assignmentId: a.id,
          vendedorId: a.vendedor_id,
          nombre: (a.mc_vendedores && a.mc_vendedores.nombre) || '—',
          vendorActivo: a.mc_vendedores ? a.mc_vendedores.activo !== false : true,
          assigned_at: a.assigned_at
        };
      })
      .sort(function (a, b) {
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }

  function zonaForVendorName(nombre) {
    const n = norm(nombre);
    const hit = cache.assignments.find(function (a) {
      const vn = a.mc_vendedores && a.mc_vendedores.nombre;
      return a.activo !== false && norm(vn) === n;
    });
    if (!hit) return null;
    return cache.zonas.find(function (z) {
      return z.id === hit.zona_id;
    }) || null;
  }

  function unassignedVendors() {
    const assignedIds = new Set(
      cache.assignments
        .filter(function (a) {
          return a.activo !== false;
        })
        .map(function (a) {
          return a.vendedor_id;
        })
    );
    const vendors =
      MC.catalog && MC.catalog.cache
        ? MC.catalog.cache.vendedores.filter(function (v) {
            return v.activo !== false;
          })
        : [];
    return vendors
      .filter(function (v) {
        return !assignedIds.has(v.id);
      })
      .sort(function (a, b) {
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }

  async function assignVendor(zonaId, vendedorId, notas) {
    // Close any active assignment for this vendor
    const { data: open } = await MC.sb
      .from('mc_zona_vendedores')
      .select('id')
      .eq('vendedor_id', vendedorId)
      .eq('activo', true);
    if (open && open.length) {
      const ids = open.map(function (r) {
        return r.id;
      });
      const { error: closeErr } = await MC.sb
        .from('mc_zona_vendedores')
        .update({
          activo: false,
          unassigned_at: new Date().toISOString(),
          notas: notas || 'reasignado'
        })
        .in('id', ids);
      if (closeErr) throw new Error(closeErr.message);
    }
    const { error } = await MC.sb.from('mc_zona_vendedores').insert([
      {
        zona_id: zonaId,
        vendedor_id: vendedorId,
        activo: true,
        notas: notas || 'asignado'
      }
    ]);
    if (error) throw new Error(error.message);
    await loadZones(true);
  }

  async function deactivateAssignment(assignmentId, notas) {
    const { error } = await MC.sb
      .from('mc_zona_vendedores')
      .update({
        activo: false,
        unassigned_at: new Date().toISOString(),
        notas: notas || 'desactivado'
      })
      .eq('id', assignmentId);
    if (error) throw new Error(error.message);
    await loadZones(true);
  }

  /** Rodar: intercambia las zonas activas de dos vendedores */
  async function rotateVendors(assignmentIdA, assignmentIdB) {
    const a = cache.assignments.find(function (x) {
      return String(x.id) === String(assignmentIdA);
    });
    const b = cache.assignments.find(function (x) {
      return String(x.id) === String(assignmentIdB);
    });
    if (!a || !b) throw new Error('Asignaciones no encontradas');
    if (a.zona_id === b.zona_id) throw new Error('Ambos están en la misma zona');

    const zonaA = a.zona_id;
    const zonaB = b.zona_id;
    const vendA = a.vendedor_id;
    const vendB = b.vendedor_id;
    const now = new Date().toISOString();

    const { error: e1 } = await MC.sb
      .from('mc_zona_vendedores')
      .update({ activo: false, unassigned_at: now, notas: 'rotar-out' })
      .in('id', [a.id, b.id]);
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await MC.sb.from('mc_zona_vendedores').insert([
      { zona_id: zonaB, vendedor_id: vendA, activo: true, notas: 'rotar-in' },
      { zona_id: zonaA, vendedor_id: vendB, activo: true, notas: 'rotar-in' }
    ]);
    if (e2) throw new Error(e2.message);
    await loadZones(true);
  }

  /** Mover vendedor a otra zona (sin swap) */
  async function moveVendor(assignmentId, newZonaId) {
    const a = cache.assignments.find(function (x) {
      return String(x.id) === String(assignmentId);
    });
    if (!a) throw new Error('Asignación no encontrada');
    if (a.zona_id === newZonaId) return;
    await assignVendor(newZonaId, a.vendedor_id, 'movido');
  }

  global.MC = global.MC || {};
  global.MC.zones = {
    cache: cache,
    load: loadZones,
    activeZonas: activeZonas,
    vendorsInZona: vendorsInZona,
    zonaForVendorName: zonaForVendorName,
    unassignedVendors: unassignedVendors,
    assignVendor: assignVendor,
    deactivateAssignment: deactivateAssignment,
    rotateVendors: rotateVendors,
    moveVendor: moveVendor,
    norm: norm
  };
})(window);
