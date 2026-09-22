/* MarquesCheck ÔÇô Resumen: Evidencias POP + Reconocimientos dashboards */
(function (global) {
  const PAGE = 1000;
  const GALL_PAGE = 24;
  const COLS_VISITAS =
    'id,fecha_creacion,promotor_nombre,cliente_nombre,estado,materiales_entregados,fotos_urls,foto_url';

  let dash = 'evidencias';
  let visitasAll = [];
  let visitasFiltered = [];
  let gallPage = 1;
  let compsAll = [];
  let compsFiltered = [];
  let compsTab = 'PENDIENTE';
  let reconMap = {};
  let bound = false;

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  function fmtDay(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return iso;
    }
  }

  function getPhotos(r) {
    if (Array.isArray(r.fotos_urls) && r.fotos_urls.length) return r.fotos_urls;
    if (r.foto_url) return [r.foto_url];
    return [];
  }

  function nameColor(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return 'hsl(' + hue + ' 55% 42%)';
  }

  function isPedido(r) {
    const tc = String(r.tipo_cierre || '').toUpperCase();
    return tc.indexOf('PEDIDO') !== -1 || tc.indexOf('PRODUCTO') !== -1;
  }

  function reconLabel(num) {
    const n = !num || num <= 0 ? 1 : num;
    const labels = {
      1: '1er reconocimiento',
      2: '2do reconocimiento',
      3: '3er reconocimiento',
      4: '4to reconocimiento',
      5: '5to reconocimiento'
    };
    return labels[n] || n + '┬░ reconocimiento';
  }

  async function fetchAll(table, orderCol, ascending, columns) {
    let all = [];
    let from = 0;
    let fallback = false;
    for (;;) {
      const cols = fallback ? '*' : columns || '*';
      const { data, error } = await MC.sb
        .from(table)
        .select(cols)
        .order(orderCol, { ascending: !!ascending })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        const colErr =
          error.code === '42703' ||
          error.code === 'PGRST116' ||
          (error.message && /does not exist|column/i.test(error.message));
        if (colErr && !fallback && from === 0) {
          fallback = true;
          continue;
        }
        throw new Error(error.message);
      }
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  function setDash(name) {
    dash = name;
    document.querySelectorAll('.resumen-dash-btn').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.dash === name);
    });
    const ev = document.getElementById('dashEvidencias');
    const rec = document.getElementById('dashReconocimientos');
    if (ev) ev.classList.toggle('hidden', name !== 'evidencias');
    if (rec) rec.classList.toggle('hidden', name !== 'reconocimientos');
    if (name === 'evidencias') renderEvidencias();
    else loadReconocimientos();
  }

  function fillSelect(el, values, allLabel, selected) {
    if (!el) return;
    const cur = selected != null ? selected : el.value;
    el.innerHTML =
      '<option value="">' +
      MC.escapeHtml(allLabel) +
      '</option>' +
      values
        .map(function (v) {
          return (
            '<option value="' +
            MC.escapeHtml(v) +
            '">' +
            MC.escapeHtml(v) +
            '</option>'
          );
        })
        .join('');
    if (cur) el.value = cur;
  }

  function populateEvFilters() {
    const estados = Array.from(
      new Set(
        visitasAll
          .map(function (r) {
            return r.estado;
          })
          .filter(Boolean)
      )
    ).sort(function (a, b) {
      return a.localeCompare(b, 'es');
    });
    const vendors =
      MC.catalog && MC.catalog.activeVendedores
        ? MC.catalog.activeVendedores().map(function (v) {
            return v.nombre;
          })
        : Array.from(
            new Set(
              visitasAll
                .map(function (r) {
                  return r.promotor_nombre;
                })
                .filter(Boolean)
            )
          ).sort();
    const mats =
      MC.catalog && MC.catalog.activeMateriales
        ? MC.catalog.activeMateriales().map(function (m) {
            return m.nombre;
          })
        : [];
    fillSelect(document.getElementById('evFilterEstado'), estados, 'Todos los estados');
    fillSelect(document.getElementById('evFilterVendedor'), vendors, 'Todos los vendedores');
    fillSelect(document.getElementById('evFilterMaterial'), mats, 'Todos los materiales');
  }

  function applyEvFilters() {
    const q = (document.getElementById('evSearch') || {}).value || '';
    const qn = q.toLowerCase().trim();
    const ven = (document.getElementById('evFilterVendedor') || {}).value || '';
    const est = (document.getElementById('evFilterEstado') || {}).value || '';
    const mat = (document.getElementById('evFilterMaterial') || {}).value || '';
    const fec = (document.getElementById('evFilterFecha') || {}).value || 'todo';
    const srt = (document.getElementById('evSortBy') || {}).value || 'reciente';
    const hoy = new Date().toLocaleDateString('en-CA');

    visitasFiltered = visitasAll.filter(function (r) {
      const okQ =
        !qn ||
        String(r.promotor_nombre || '')
          .toLowerCase()
          .indexOf(qn) !== -1 ||
        String(r.cliente_nombre || '')
          .toLowerCase()
          .indexOf(qn) !== -1;
      const okV = !ven || r.promotor_nombre === ven;
      const okE = !est || r.estado === est;
      const okM = !mat || (r.materiales_entregados || []).indexOf(mat) !== -1;
      let okF = true;
      if (fec === 'hoy') okF = r.fecha_creacion && String(r.fecha_creacion).indexOf(hoy) === 0;
      return okQ && okV && okE && okM && okF;
    });

    visitasFiltered.sort(function (a, b) {
      if (srt === 'antiguo') return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
      if (srt === 'vendedor')
        return String(a.promotor_nombre || '').localeCompare(String(b.promotor_nombre || ''), 'es');
      if (srt === 'estado')
        return String(a.estado || '').localeCompare(String(b.estado || ''), 'es');
      return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
    });

    gallPage = 1;
    const cnt = document.getElementById('evResultsCount');
    if (cnt) {
      cnt.textContent =
        visitasFiltered.length +
        ' registro' +
        (visitasFiltered.length !== 1 ? 's' : '') +
        ' encontrado' +
        (visitasFiltered.length !== 1 ? 's' : '');
    }
    renderEvStats(visitasFiltered.length ? visitasFiltered : visitasAll);
    renderEvDistribucion(visitasAll);
    renderEvRanking(visitasAll);
    renderEvGallery(false);
  }

  function renderEvStats(data) {
    const uniqVen = new Set(
      data
        .map(function (r) {
          return r.promotor_nombre;
        })
        .filter(Boolean)
    ).size;
    const totalMat = data.reduce(function (s, r) {
      return s + (r.materiales_entregados || []).length;
    }, 0);
    const totalFot = data.reduce(function (s, r) {
      return s + getPhotos(r).length;
    }, 0);
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('evStatVisitas', data.length);
    set('evStatVendedores', uniqVen);
    set('evStatMateriales', totalMat);
    set('evStatFotos', totalFot);
  }

  function renderEvDistribucion(data) {
    const el = document.getElementById('evDistribucion');
    if (!el) return;
    const counts = {};
    data.forEach(function (r) {
      const e = r.estado || 'NO DEFINIDO';
      counts[e] = (counts[e] || 0) + 1;
    });
    const sorted = Object.keys(counts)
      .map(function (k) {
        return [k, counts[k]];
      })
      .sort(function (a, b) {
        return b[1] - a[1];
      });
    if (!sorted.length) {
      el.innerHTML = '<p class="text-sm text-gray-400">Sin datos.</p>';
      return;
    }
    const max = sorted[0][1] || 1;
    const total = sorted.reduce(function (s, x) {
      return s + x[1];
    }, 0);
    el.innerHTML = sorted
      .map(function (pair) {
        const estado = pair[0];
        const count = pair[1];
        const pct = Math.round((count / max) * 100);
        const pctT = total ? Math.round((count / total) * 100) : 0;
        return (
          '<div class="ev-bar-row">' +
          '<span class="ev-bar-label">' +
          MC.escapeHtml(estado) +
          '</span>' +
          '<div class="ev-bar-track"><div class="ev-bar-fill" style="width:' +
          pct +
          '%"></div></div>' +
          '<span class="ev-bar-count" title="' +
          pctT +
          '%">' +
          count +
          '</span></div>'
        );
      })
      .join('');
  }

  function renderEvRanking(data) {
    const el = document.getElementById('evRanking');
    if (!el) return;
    const map = {};
    data.forEach(function (r) {
      const k = r.promotor_nombre ? String(r.promotor_nombre).toUpperCase().trim() : 'SIN NOMBRE';
      if (!map[k]) map[k] = { nombre: k, visitas: 0, materiales: 0, fotos: 0 };
      map[k].visitas++;
      map[k].materiales += (r.materiales_entregados || []).length;
      map[k].fotos += getPhotos(r).length;
    });
    const ranking = Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return b.visitas - a.visitas || b.materiales - a.materiales;
      });
    if (!ranking.length) {
      el.innerHTML = '<p class="text-sm text-gray-400 py-4 text-center">Sin datos de vendedores.</p>';
      return;
    }
    el.innerHTML = ranking
      .slice(0, 15)
      .map(function (v, i) {
        const pos = i + 1;
        const prom = v.visitas ? (v.materiales / v.visitas).toFixed(1) : '0.0';
        const init = v.nombre.slice(0, 2).toUpperCase();
        const bg = nameColor(v.nombre);
        const medal = pos === 1 ? '­ƒÑç' : pos === 2 ? '­ƒÑê' : pos === 3 ? '­ƒÑë' : pos;
        return (
          '<div class="ev-rank-row">' +
          '<span class="ev-rank-pos">' +
          medal +
          '</span>' +
          '<div class="ev-rank-avatar" style="background:' +
          bg +
          '">' +
          MC.escapeHtml(init) +
          '</div>' +
          '<div class="ev-rank-info"><p class="ev-rank-name">' +
          MC.escapeHtml(v.nombre) +
          '</p><p class="ev-rank-meta">' +
          v.visitas +
          ' clientes ┬À ' +
          v.materiales +
          ' mat ┬À prom ' +
          prom +
          ' ┬À ' +
          v.fotos +
          ' fotos</p></div></div>'
        );
      })
      .join('');
  }

  function chipsHtml(mats) {
    if (!mats || !mats.length) return '<span class="text-xs text-gray-400">Sin materiales</span>';
    return mats
      .map(function (m) {
        return '<span class="resumen-chip">' + MC.escapeHtml(m) + '</span>';
      })
      .join('');
  }

  function renderEvGallery(append) {
    const grid = document.getElementById('evGallery');
    const pag = document.getElementById('evPagination');
    if (!grid) return;
    if (!visitasFiltered.length) {
      grid.innerHTML =
        '<div class="py-10 text-center text-sm text-gray-500">No hay visitas con esos filtros.</div>';
      if (pag) pag.innerHTML = '';
      return;
    }
    const start = append ? (gallPage - 1) * GALL_PAGE : 0;
    const end = gallPage * GALL_PAGE;
    const chunk = visitasFiltered.slice(start, end);
    const html = chunk
      .map(function (r) {
        const fotos = getPhotos(r);
        const mats = r.materiales_entregados || [];
        const init = String(r.promotor_nombre || '?')
          .slice(0, 2)
          .toUpperCase();
        const thumbs = fotos
          .slice(0, 6)
          .map(function (u) {
            return (
              '<a href="' +
              MC.escapeHtml(u) +
              '" target="_blank" rel="noopener" class="thumb-link"><img src="' +
              MC.escapeHtml(u) +
              '" alt="evidencia" loading="lazy"></a>'
            );
          })
          .join('');
        return (
          '<article class="visita-card">' +
          '<div class="flex items-center gap-3 mb-3">' +
          '<div class="ev-rank-avatar" style="background:' +
          nameColor(r.promotor_nombre) +
          '">' +
          MC.escapeHtml(init) +
          '</div>' +
          '<div class="min-w-0 flex-1"><p class="font-bold text-sm truncate">' +
          MC.escapeHtml(r.promotor_nombre || 'ÔÇö') +
          '</p><p class="text-xs text-gray-500">' +
          fmtDate(r.fecha_creacion) +
          '</p></div>' +
          (r.estado
            ? '<span class="badge-visita">' + MC.escapeHtml(r.estado) + '</span>'
            : '') +
          '</div>' +
          '<p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Cliente</p>' +
          '<h4 class="text-base font-extrabold text-gray-900 mb-2">' +
          MC.escapeHtml(r.cliente_nombre || 'Cliente') +
          '</h4>' +
          '<div class="flex flex-wrap gap-1.5 mb-3">' +
          chipsHtml(mats) +
          '</div>' +
          '<p class="text-[11px] font-bold text-brand-700 uppercase tracking-wide mb-1">Evidencias (' +
          fotos.length +
          ')</p>' +
          (fotos.length
            ? '<div class="grid grid-cols-3 gap-2">' + thumbs + '</div>'
            : '<p class="text-xs text-gray-400">Sin fotos</p>') +
          '</article>'
        );
      })
      .join('');

    if (append) grid.insertAdjacentHTML('beforeend', html);
    else grid.innerHTML = html;

    if (pag) {
      if (end < visitasFiltered.length) {
        pag.innerHTML =
          '<button type="button" id="evLoadMore" class="w-full py-3 rounded-xl bg-white border border-gray-200 text-brand-700 text-sm font-bold">Mostrar m├ís (' +
          (visitasFiltered.length - end) +
          ' restantes)</button>';
        const btn = document.getElementById('evLoadMore');
        if (btn) {
          btn.addEventListener('click', function () {
            gallPage++;
            renderEvGallery(true);
          });
        }
      } else {
        pag.innerHTML = '';
      }
    }
  }

  function renderEvidencias() {
    populateEvFilters();
    applyEvFilters();
  }

  async function loadEvidencias() {
    const status = document.getElementById('evStatus');
    if (status) status.textContent = 'Cargando evidenciasÔÇª';
    try {
      visitasAll = await fetchAll('sorteo_registros', 'fecha_creacion', false, COLS_VISITAS);
      if (status) {
        status.textContent =
          'Actualizado ' +
          new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      }
      renderEvidencias();
    } catch (err) {
      const grid = document.getElementById('evGallery');
      if (grid) {
        grid.innerHTML =
          '<div class="py-8 text-center text-sm text-red-600">' +
          MC.escapeHtml(err.message) +
          '</div>';
      }
      if (status) status.textContent = 'Error al cargar';
    }
  }

  async function computeReconNumbers() {
    const { data, error } = await MC.sb
      .from('compensaciones')
      .select('id,cliente_nombre,created_at')
      .order('created_at', { ascending: true });
    if (error || !data) return {};
    const byClient = {};
    data.forEach(function (r) {
      if (!byClient[r.cliente_nombre]) byClient[r.cliente_nombre] = [];
      byClient[r.cliente_nombre].push(r);
    });
    const map = {};
    Object.keys(byClient).forEach(function (cliente) {
      const recs = byClient[cliente].slice().sort(function (a, b) {
        return new Date(a.created_at) - new Date(b.created_at);
      });
      let reconNum = 0;
      let lastDate = null;
      recs.forEach(function (r) {
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        if (d !== lastDate) {
          reconNum++;
          lastDate = d;
        }
        map[String(r.id)] = reconNum;
      });
    });
    return map;
  }

  async function loadReconocimientos() {
    const list = document.getElementById('recGroups');
    if (list) list.innerHTML = '<div class="py-8 text-center text-sm text-gray-500">CargandoÔÇª</div>';
    try {
      reconMap = await computeReconNumbers();
      let query = MC.sb.from('compensaciones').select('*').order('created_at', { ascending: false });
      if (compsTab === 'PENDIENTE') query = query.eq('estado_proceso', 'PENDIENTE');
      else query = query.in('estado_proceso', ['APROBADO', 'RECHAZADO']);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      compsAll = data || [];
      compsAll.forEach(function (r) {
        r.num_reconocimiento = reconMap[String(r.id)] || r.num_reconocimiento || 1;
      });
      await refreshRecCounts();
      populateRecFilters();
      applyRecFilters();
    } catch (err) {
      if (list) {
        list.innerHTML =
          '<div class="py-8 text-center text-sm text-red-600">' +
          MC.escapeHtml(err.message) +
          '</div>';
      }
    }
  }

  async function refreshRecCounts() {
    const [p, a, r] = await Promise.all([
      MC.sb.from('compensaciones').select('*', { count: 'exact', head: true }).eq('estado_proceso', 'PENDIENTE'),
      MC.sb.from('compensaciones').select('*', { count: 'exact', head: true }).eq('estado_proceso', 'APROBADO'),
      MC.sb.from('compensaciones').select('*', { count: 'exact', head: true }).eq('estado_proceso', 'RECHAZADO')
    ]);
    const cntP = document.getElementById('recCntPend');
    const cntR = document.getElementById('recCntResult');
    if (cntP) cntP.textContent = p.count || 0;
    if (cntR) cntR.textContent = (a.count || 0) + (r.count || 0);
  }

  function populateRecFilters() {
    const promotores = Array.from(
      new Set(
        compsAll
          .map(function (r) {
            return r.promotor_nombre;
          })
          .filter(Boolean)
      )
    ).sort();
    const productos = Array.from(
      new Set(
        compsAll
          .map(function (r) {
            return r.producto;
          })
          .filter(Boolean)
      )
    ).sort();
    fillSelect(document.getElementById('recFilterPromotor'), promotores, 'Todos los vendedores');
    fillSelect(document.getElementById('recFilterProducto'), productos, 'Todos los productos');
  }

  function applyRecFilters() {
    const q = ((document.getElementById('recSearch') || {}).value || '').toLowerCase().trim();
    const prom = (document.getElementById('recFilterPromotor') || {}).value || '';
    const prod = (document.getElementById('recFilterProducto') || {}).value || '';
    const tipo = (document.getElementById('recFilterTipo') || {}).value || '';

    compsFiltered = compsAll.filter(function (r) {
      let matchTipo = true;
      if (tipo === 'PEDIDO') matchTipo = isPedido(r);
      if (tipo === 'CREDITO') matchTipo = !isPedido(r);
      const matchQ =
        !q ||
        [r.cliente_nombre, r.promotor_nombre, r.producto, r.numero_factura].some(function (v) {
          return v && String(v).toLowerCase().indexOf(q) !== -1;
        });
      return matchQ && (!prom || r.promotor_nombre === prom) && (!prod || r.producto === prod) && matchTipo;
    });
    updateRecStats();
    renderRecGroups();
  }

  function updateRecStats() {
    const clientKeys = new Set(
      compsFiltered.map(function (r) {
        return r.cliente_nombre + '|||' + (r.num_reconocimiento || 1);
      })
    );
    let totalCredito = 0;
    let totalPacas = 0;
    compsFiltered
      .filter(function (r) {
        return r.estado_proceso === 'APROBADO' || r.estado_proceso === 'PENDIENTE';
      })
      .forEach(function (r) {
        if (isPedido(r)) totalPacas += r.pacas_a_entregar || 0;
        else totalCredito += r.total_compensar || 0;
      });
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('recStatClients', clientKeys.size);
    set('recStatSkus', compsFiltered.length);
    set('recStatCredito', '$' + totalCredito.toFixed(2));
    set('recStatPacas', totalPacas + ' pacas');
  }

  function renderRecGroups() {
    const gl = document.getElementById('recGroups');
    if (!gl) return;
    if (!compsFiltered.length) {
      gl.innerHTML =
        '<div class="py-10 text-center text-sm text-gray-500">No hay registros en esta categor├¡a.</div>';
      return;
    }
    const groups = {};
    compsFiltered.forEach(function (r) {
      const reconNum = r.num_reconocimiento || 1;
      const key = r.cliente_nombre + '|||' + reconNum;
      if (!groups[key]) {
        groups[key] = {
          cliente: r.cliente_nombre,
          promotor: r.promotor_nombre,
          reconNum: reconNum,
          items: []
        };
      }
      groups[key].items.push(r);
    });
    const sorted = Object.keys(groups)
      .map(function (k) {
        return groups[k];
      })
      .sort(function (a, b) {
        if (a.cliente !== b.cliente) return String(a.cliente || '').localeCompare(String(b.cliente || ''), 'es');
        return b.reconNum - a.reconNum;
      });

    gl.innerHTML = sorted
      .map(function (g, gi) {
        let totalCredito = 0;
        let totalPedido = 0;
        g.items
          .filter(function (i) {
            return i.estado_proceso === 'APROBADO' || i.estado_proceso === 'PENDIENTE';
          })
          .forEach(function (i) {
            if (isPedido(i)) totalPedido += i.pacas_a_entregar || 0;
            else totalCredito += i.total_compensar || 0;
          });
        let badge = g.items.length + ' SKU';
        let badgeCls = '';
        if (compsTab !== 'PENDIENTE') {
          const apros = g.items.filter(function (i) {
            return i.estado_proceso === 'APROBADO';
          }).length;
          const rechs = g.items.filter(function (i) {
            return i.estado_proceso === 'RECHAZADO';
          }).length;
          if (apros && !rechs) {
            badgeCls = 'ok';
            badge = apros + ' aprobado' + (apros > 1 ? 's' : '');
          } else if (rechs && !apros) {
            badgeCls = 'danger';
            badge = rechs + ' rechazado' + (rechs > 1 ? 's' : '');
          } else {
            badge = apros + ' apr ┬À ' + rechs + ' rec';
          }
        }
        const totals =
          (totalCredito
            ? '<span class="rec-total-credito">$' + totalCredito.toFixed(2) + '</span>'
            : '') +
          (totalPedido
            ? '<span class="rec-total-pedido">+' + totalPedido + ' pacas</span>'
            : '') +
          (!totalCredito && !totalPedido ? '<span class="text-xs text-gray-400">$0</span>' : '');

        const itemsHtml = g.items
          .map(function (item) {
            const st = item.estado_proceso;
            const stCls =
              st === 'PENDIENTE' ? 'pending' : st === 'APROBADO' ? 'approved' : 'rejected';
            const primary = isPedido(item)
              ? '+' + (item.pacas_a_entregar || 0) + ' pacas'
              : '$' + Number(item.total_compensar || 0).toFixed(2);
            const fotos = item.fotos_inventario || [];
            const thumbs = fotos
              .slice(0, 3)
              .map(function (u) {
                return (
                  '<a href="' +
                  MC.escapeHtml(u) +
                  '" target="_blank" rel="noopener" class="thumb-link"><img src="' +
                  MC.escapeHtml(u) +
                  '" alt="inventario" loading="lazy"></a>'
                );
              })
              .join('');
            return (
              '<div class="rec-sku">' +
              '<div class="flex items-start justify-between gap-2 mb-1">' +
              '<div><p class="font-bold text-sm text-gray-900">' +
              MC.escapeHtml(item.producto || 'Producto') +
              '</p><p class="text-[11px] text-gray-500">Factura ' +
              MC.escapeHtml(item.numero_factura || 'ÔÇö') +
              ' ┬À ' +
              fmtDay(item.created_at) +
              '</p></div>' +
              '<span class="rec-status ' +
              stCls +
              '">' +
              MC.escapeHtml(st || 'ÔÇö') +
              '</span></div>' +
              '<div class="flex items-center justify-between text-sm mb-2">' +
              '<span class="font-extrabold ' +
              (isPedido(item) ? 'text-blue-700' : 'text-emerald-700') +
              '">' +
              primary +
              '</span>' +
              '<span class="text-xs text-gray-500">' +
              MC.escapeHtml(item.tipo_cierre || 'ÔÇö') +
              '</span></div>' +
              (fotos.length
                ? '<div class="grid grid-cols-3 gap-2">' + thumbs + '</div>'
                : '') +
              '</div>'
            );
          })
          .join('');

        return (
          '<div class="rec-group" data-open="0">' +
          '<button type="button" class="rec-group-head" data-gi="' +
          gi +
          '">' +
          '<div class="min-w-0 flex-1 text-left"><p class="font-extrabold text-sm text-gray-900 truncate">' +
          MC.escapeHtml(g.cliente || 'Cliente') +
          '</p><p class="text-[11px] text-gray-500">' +
          MC.escapeHtml(g.promotor || 'ÔÇö') +
          ' ┬À ' +
          reconLabel(g.reconNum) +
          '</p></div>' +
          '<div class="flex flex-col items-end gap-1 shrink-0">' +
          '<span class="rec-badge ' +
          badgeCls +
          '">' +
          badge +
          '</span>' +
          '<div class="flex gap-2 items-center">' +
          totals +
          '</div></div></button>' +
          '<div class="rec-group-body hidden">' +
          itemsHtml +
          '</div></div>'
        );
      })
      .join('');

    gl.querySelectorAll('.rec-group-head').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const group = btn.closest('.rec-group');
        const body = group.querySelector('.rec-group-body');
        const open = group.dataset.open === '1';
        group.dataset.open = open ? '0' : '1';
        body.classList.toggle('hidden', open);
      });
    });
  }

  async function loadResumen() {
    if (dash === 'evidencias') await loadEvidencias();
    else await loadReconocimientos();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.querySelectorAll('.resumen-dash-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setDash(btn.dataset.dash);
      });
    });

    const refresh = document.getElementById('btnRefreshResumen');
    if (refresh) refresh.addEventListener('click', loadResumen);

    ['evSearch', 'evFilterVendedor', 'evFilterEstado', 'evFilterMaterial', 'evFilterFecha', 'evSortBy'].forEach(
      function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = id === 'evSearch' ? 'input' : 'change';
        el.addEventListener(evt, applyEvFilters);
      }
    );

    const clearEv = document.getElementById('evClearFilters');
    if (clearEv) {
      clearEv.addEventListener('click', function () {
        ['evSearch', 'evFilterVendedor', 'evFilterEstado', 'evFilterMaterial'].forEach(function (id) {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        const fec = document.getElementById('evFilterFecha');
        if (fec) fec.value = 'todo';
        applyEvFilters();
      });
    }

    document.querySelectorAll('.rec-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        compsTab = btn.dataset.rectab;
        document.querySelectorAll('.rec-tab-btn').forEach(function (b) {
          b.classList.toggle('activo', b.dataset.rectab === compsTab);
        });
        loadReconocimientos();
      });
    });

    ['recSearch', 'recFilterPromotor', 'recFilterProducto', 'recFilterTipo'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'recSearch' ? 'input' : 'change', applyRecFilters);
    });

    const clearRec = document.getElementById('recClearFilters');
    if (clearRec) {
      clearRec.addEventListener('click', function () {
        ['recSearch', 'recFilterPromotor', 'recFilterProducto', 'recFilterTipo'].forEach(function (id) {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        applyRecFilters();
      });
    }
  }

  function initResumen() {
    bindOnce();
  }

  global.MC = global.MC || {};
  global.MC.resumen = { init: initResumen, load: loadResumen };
})(window);
