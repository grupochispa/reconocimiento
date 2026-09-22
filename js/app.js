/* Reconocimiento dashboard – auth-gated Resumen + Admin */
(function () {
  function showLogin(opts) {
    opts = opts || {};
    document.getElementById("loginWrap").style.display = "flex";
    document.getElementById("appWrap").style.display = "none";
    var boot = document.getElementById("bootstrapBox");
    var form = document.getElementById("loginForm");
    if (boot) boot.classList.toggle("hidden", !opts.bootstrap);
    if (form) form.classList.toggle("hidden", !!opts.bootstrap);
  }

  function showApp(session) {
    document.getElementById("loginWrap").style.display = "none";
    document.getElementById("appWrap").style.display = "flex";
    var label = (session && (session.username || session.email)) || "usuario";
    var el = document.getElementById("headerUser");
    if (el) el.textContent = label;
  }

  function showView(name) {
    if (name !== "resumen" && name !== "admin") name = "resumen";
    document.querySelectorAll(".view-panel").forEach(function (p) {
      p.classList.toggle("activo", p.dataset.view === name);
    });
    document.querySelectorAll(".mc-nav-btn").forEach(function (b) {
      b.classList.toggle("activo", b.dataset.view === name);
    });
    if (name === "resumen" && MC.resumen) MC.resumen.load();
    if (name === "admin" && MC.admin) MC.admin.refresh();
  }

  async function enterApp(session) {
    showApp(session);
    try {
      MC.setLoading(true, "Cargando…");
      await MC.catalog.loadCatalogs(true);
      MC.resumen.init();
      MC.admin.init();
      MC.setLoading(false);
      showView("resumen");
    } catch (e) {
      MC.setLoading(false);
      MC.showToast("Error: " + e.message, "error");
      showView("resumen");
    }
  }

  async function boot() {
    var headerLogo = document.getElementById("headerLogo");
    if (headerLogo && window.logoPngBase64) {
      headerLogo.src = window.logoPngBase64;
      headerLogo.style.filter = "brightness(0) invert(1)";
    }

    document.querySelectorAll(".mc-nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { showView(btn.dataset.view); });
    });

    document.getElementById("btnLogout").addEventListener("click", async function () {
      await MC.auth.logout();
      showLogin({});
    });

    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = document.getElementById("btnLogin");
      var user = document.getElementById("loginUser").value;
      var pwd = document.getElementById("loginPwd").value;
      var err = document.getElementById("loginError");
      err.textContent = "";
      btn.disabled = true;
      btn.textContent = "Verificando…";
      try {
        await MC.auth.login(user, pwd);
        var auth = await MC.auth.ensureAuthenticated();
        if (!auth.ok) throw new Error("Sesión no válida");
        await enterApp(auth.session);
      } catch (ex) {
        err.textContent = ex.message || "Error de acceso";
      } finally {
        btn.disabled = false;
        btn.textContent = "Iniciar sesión";
      }
    });

    document.getElementById("bootstrapForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var user = document.getElementById("bootUser").value;
      var pwd = document.getElementById("bootPwd").value;
      var err = document.getElementById("bootError");
      err.textContent = "";
      try {
        await MC.auth.bootstrapAdmin(user, pwd);
        var auth = await MC.auth.ensureAuthenticated();
        if (!auth.ok) throw new Error("No se pudo iniciar sesión");
        await enterApp(auth.session);
      } catch (ex) {
        err.textContent = ex.message || "Error";
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();