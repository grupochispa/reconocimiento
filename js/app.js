/* Reconocimiento dashboard – sidebar + auth-gated views */
(function () {
  function showLogin(opts) {
    opts = opts || {};
    document.getElementById('loginWrap').style.display = 'flex';
    document.getElementById('appWrap').style.display = 'none';
    var boot = document.getElementById('bootstrapBox');
    var form = document.getElementById('loginForm');
    if (boot) boot.classList.toggle('hidden', !opts.bootstrap);
    if (form) form.classList.toggle('hidden', !!opts.bootstrap);
  }

  function showApp(session) {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('appWrap').style.display = 'flex';
    var label = (session && (session.username || session.email)) || 'usuario';
    var el = document.getElementById('headerUser');
    if (el) el.textContent = label;
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    var bd = document.getElementById('sidebarBackdrop');
    if (bd) bd.hidden = true;
  }

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    var bd = document.getElementById('sidebarBackdrop');
    if (bd) bd.hidden = false;
  }

  function showView(name, adminTab) {
    var views = ['evidencias', 'reconocimientos', 'zonas', 'admin'];
    if (views.indexOf(name) === -1) name = 'evidencias';

    document.querySelectorAll('.view-panel').forEach(function (p) {
      p.classList.toggle('activo', p.dataset.view === name);
    });
    document.querySelectorAll('.sidebar-link[data-view]').forEach(function (b) {
      var match = b.dataset.view === name;
      if (name === 'admin' && b.dataset.adminTab) {
        match = match && b.dataset.adminTab === (adminTab || 'usuarios');
      } else if (name !== 'admin') {
        match = b.dataset.view === name && !b.dataset.adminTab;
      }
      b.classList.toggle('activo', !!match);
    });

    if (name === 'admin') {
      var tab = adminTab || 'usuarios';
      if (MC.admin && MC.admin.openTab) MC.admin.openTab(tab);
      else if (MC.admin) MC.admin.refresh();
    } else if (MC.resumen) {
      MC.resumen.loadView(name);
    }
    closeSidebar();
  }

  async function enterApp(session) {
    showApp(session);
    try {
      MC.setLoading(true, 'Cargando…');
      await MC.catalog.loadCatalogs(true);
      try {
        if (MC.zones) await MC.zones.load(true);
      } catch (e) {
        /* zonas opcionales hasta aplicar SQL */
      }
      MC.resumen.init();
      MC.admin.init();
      MC.setLoading(false);
      showView('evidencias');
    } catch (e) {
      MC.setLoading(false);
      MC.showToast('Error: ' + e.message, 'error');
      showView('evidencias');
    }
  }

  async function boot() {
    var headerLogo = document.getElementById('headerLogo');
    if (headerLogo && window.logoPngBase64) {
      headerLogo.src = window.logoPngBase64;
      headerLogo.style.filter = 'brightness(0) invert(1)';
    }

    document.querySelectorAll('.sidebar-link[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showView(btn.dataset.view, btn.dataset.adminTab);
      });
    });

    var toggle = document.getElementById('btnSidebarToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (document.body.classList.contains('sidebar-open')) closeSidebar();
        else openSidebar();
      });
    }
    var backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    var gotoAssign = document.getElementById('btnGotoAssignZonas');
    if (gotoAssign) {
      gotoAssign.addEventListener('click', function () {
        showView('admin', 'zonas');
      });
    }

    document.getElementById('btnLogout').addEventListener('click', async function () {
      await MC.auth.logout();
      showLogin({});
    });

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = document.getElementById('btnLogin');
      var user = document.getElementById('loginUser').value;
      var pwd = document.getElementById('loginPwd').value;
      var err = document.getElementById('loginError');
      err.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Verificando…';
      try {
        await MC.auth.login(user, pwd);
        var auth = await MC.auth.ensureAuthenticated();
        if (!auth.ok) throw new Error('Sesión no válida');
        await enterApp(auth.session);
      } catch (ex) {
        err.textContent = ex.message || 'Error de acceso';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Iniciar sesión';
      }
    });

    document.getElementById('bootstrapForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var user = document.getElementById('bootUser').value;
      var pwd = document.getElementById('bootPwd').value;
      var err = document.getElementById('bootError');
      err.textContent = '';
      try {
        await MC.auth.bootstrapAdmin(user, pwd);
        var auth = await MC.auth.ensureAuthenticated();
        if (!auth.ok) throw new Error('No se pudo iniciar sesión');
        await enterApp(auth.session);
      } catch (ex) {
        err.textContent = ex.message || 'Error';
      }
    });

    var auth = await MC.auth.ensureAuthenticated();
    if (auth.ok) {
      await enterApp(auth.session);
      return;
    }

    var counted = await MC.auth.countUsers();
    if (!counted.error && counted.count === 0) {
      showLogin({ bootstrap: true });
    } else {
      showLogin({});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
