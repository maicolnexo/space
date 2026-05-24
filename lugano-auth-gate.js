/**
 * Autenticación en dos pasos: Google + cuenta en Firestore «administradores».
 * Requiere: firebase-config.js, lugano-admin-auth.js, firebase-app/auth/firestore compat,
 * y en el HTML: #auth-gate, #main-app, #btn-google-signin, etc.
 */
(function () {
  if (typeof firebase === "undefined" || !firebase.apps) return;
  if (typeof LuganoAdminAuth === "undefined") {
    console.error("Falta lugano-admin-auth.js antes de lugano-auth-gate.js");
    return;
  }

  try {
    firebase.initializeApp(typeof firebaseConfig !== "undefined" ? firebaseConfig : {});
  } catch (e) {
    if (e.code !== "app/duplicate-app") throw e;
  }

  var auth = firebase.auth();
  var adminAuth = LuganoAdminAuth;

  var authErrorStrip = document.getElementById("auth-error-strip");
  var authBannerDetail = document.getElementById("auth-banner-detail");
  var authDomainHint = document.getElementById("auth-domain-hint");
  var btnGoogleSignin = document.getElementById("btn-google-signin");
  var btnSignOut = document.getElementById("btn-signout");

  var authLoggedOutEl = document.getElementById("auth-logged-out");
  var authAdminStepEl = null;
  var adminEmailInput = null;
  var adminPassInput = null;
  var btnAdminSubmit = null;
  var btnAdminBackGoogle = null;
  var adminGateHint = null;

  function ensureAdminStepMarkup() {
    if (document.getElementById("auth-admin-step")) {
      authAdminStepEl = document.getElementById("auth-admin-step");
      adminEmailInput = document.getElementById("auth-admin-email");
      adminPassInput = document.getElementById("auth-admin-password");
      btnAdminSubmit = document.getElementById("btn-admin-submit");
      btnAdminBackGoogle = document.getElementById("btn-admin-back-google");
      adminGateHint = document.getElementById("auth-admin-hint");
      return;
    }
    var gate = document.getElementById("auth-gate");
    if (!gate) return;

    var wrap = document.createElement("div");
    wrap.id = "auth-admin-step";
    wrap.className = "auth-panel-inner auth-gate-card auth-admin-step";
    wrap.hidden = true;
    wrap.innerHTML =
      '<p class="auth-panel-title" id="auth-admin-title">Cuenta de administración</p>' +
      '<p class="auth-panel-desc">Google validado. Ingrese el <strong>correo y contraseña</strong> registrados en la colección <strong>administradores</strong> de Firestore.</p>' +
      '<p id="auth-admin-google-line" class="auth-admin-google-line"></p>' +
      '<label class="auth-admin-field"><span>Correo administración</span><input type="email" id="auth-admin-email" autocomplete="username" placeholder="correo@empresa.com" /></label>' +
      '<label class="auth-admin-field"><span>Contraseña</span><input type="password" id="auth-admin-password" autocomplete="current-password" placeholder="Contraseña" /></label>' +
      '<button type="button" id="btn-admin-submit" class="auth-admin-submit">Acceder al portal</button>' +
      '<button type="button" id="btn-admin-back-google" class="auth-admin-back">Usar otra cuenta Google</button>' +
      '<p id="auth-admin-hint" class="auth-domain-hint auth-admin-hint"></p>';

    gate.appendChild(wrap);
    authAdminStepEl = wrap;
    adminEmailInput = document.getElementById("auth-admin-email");
    adminPassInput = document.getElementById("auth-admin-password");
    btnAdminSubmit = document.getElementById("btn-admin-submit");
    btnAdminBackGoogle = document.getElementById("btn-admin-back-google");
    adminGateHint = document.getElementById("auth-admin-hint");

    if (btnAdminSubmit) {
      btnAdminSubmit.addEventListener("click", onAdminSubmit);
    }
    if (btnAdminBackGoogle) {
      btnAdminBackGoogle.addEventListener("click", function () {
        adminAuth.clearAdminSession();
        auth.signOut().catch(function () {}).then(function () {
          location.reload();
        });
      });
    }
    if (adminPassInput) {
      adminPassInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          onAdminSubmit();
        }
      });
    }
  }

  function setAuthGateRightsFooter() {
    if (!authDomainHint) return;
    authDomainHint.classList.remove("auth-domain-hint--technical");
    authDomainHint.innerHTML =
      '<span class="auth-gate-footer-brand">' +
      '<img src="logolugano1.jpg" width="36" height="36" alt="" class="auth-gate-footer-logo" loading="lazy" decoding="async" />' +
      '<span class="auth-gate-footer-text">' +
      '<span class="auth-gate-footer-title">S.P.A.C.E<span class="auth-reg-mark" title="Marca registrada">®</span></span>' +
      '<span class="auth-gate-footer-sub">Titular de los derechos de esta aplicación y del sistema de gestión y administración. Marca y software de uso corporativo reservado.</span>' +
      '<span class="auth-gate-footer-author"><span class="auth-gate-footer-author-label">Desarrollo y representación</span>Michael Eduardo Carreño Sánchez</span>' +
      "</span></span>";
  }

  function updateAuthDomainHint(err) {
    if (!authDomainHint) return;
    var proto = window.location.protocol;
    var host = window.location.hostname || "";

    if (proto === "file:") {
      authDomainHint.classList.add("auth-domain-hint--technical");
      authDomainHint.textContent =
        "Para un acceso estable, abra esta aplicación desde la red interna o un servidor web (http/https), no como archivo guardado en el equipo.";
      return;
    }

    if (err && err.code === "auth/unauthorized-domain") {
      authDomainHint.classList.add("auth-domain-hint--technical");
      authDomainHint.textContent =
        "Este sitio no está autorizado para el inicio de sesión. Solicite al administrador de sistemas que registre el dominio «" +
        host +
        "» (sin puerto) entre los dominios permitidos. Si también entra por «localhost», debe indicarse aparte. Espere un momento y vuelva a intentarlo.";
      return;
    }

    setAuthGateRightsFooter();
  }

  function formatAuthError(err) {
    if (!err) return "";
    if (typeof err === "string") return err;
    var code = err.code || "";
    var msg = err.message || "";
    if (code === "auth/popup-closed-by-user") {
      return code + " — La ventana de Google se cerró antes de finalizar el inicio de sesión.";
    }
    if (code === "auth/unauthorized-domain") {
      return (
        code +
        " — El dominio «" +
        (window.location.hostname || "") +
        "» debe estar autorizado para el acceso. Consulte a administración de sistemas o el aviso en pantalla."
      );
    }
    return code + (msg ? " — " + msg : "");
  }

  function showAuthError(err) {
    if (authErrorStrip) authErrorStrip.style.display = "block";
    if (authBannerDetail && err) authBannerDetail.textContent = formatAuthError(err);
    updateAuthDomainHint(err && err.code ? err : null);
  }

  function hideAuthError() {
    if (authErrorStrip) authErrorStrip.style.display = "none";
  }

  function showAdminStepError(msg) {
    if (adminGateHint) {
      adminGateHint.classList.add("auth-domain-hint--technical");
      adminGateHint.textContent = msg || "";
    }
    if (msg) showAuthError(msg);
  }

  function clearAdminStepError() {
    if (adminGateHint) {
      adminGateHint.classList.remove("auth-domain-hint--technical");
      adminGateHint.textContent = "";
    }
  }

  var AUTH_SESSION_START_KEY = "lugano-auth-session-start-ms";

  function ensureAuthSessionTimestamp() {
    try {
      if (!sessionStorage.getItem(AUTH_SESSION_START_KEY)) {
        sessionStorage.setItem(AUTH_SESSION_START_KEY, String(Date.now()));
      }
    } catch (e) {}
  }

  function clearAuthSessionTimestamp() {
    try {
      sessionStorage.removeItem(AUTH_SESSION_START_KEY);
    } catch (e) {}
  }

  function formatAuthSessionStarted(isoOrMs) {
    if (!isoOrMs) return "";
    var d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function showAuthGateStep(step, user) {
    var authGate = document.getElementById("auth-gate");
    if (authGate) {
      authGate.hidden = false;
      authGate.setAttribute("aria-modal", "true");
    }
    document.body.classList.add("auth-gate-active");

    if (authLoggedOutEl) authLoggedOutEl.hidden = step !== "google";
    if (authAdminStepEl) authAdminStepEl.hidden = step !== "admin";

    if (step === "admin" && user) {
      var line = document.getElementById("auth-admin-google-line");
      if (line) {
        line.textContent = "Sesión Google: " + (user.email || user.displayName || user.uid);
      }
      if (adminEmailInput && user.email && !adminEmailInput.value) {
        adminEmailInput.value = user.email;
      }
      clearAdminStepError();
    }
  }

  function hideAuthGate() {
    var authGate = document.getElementById("auth-gate");
    if (authGate) {
      authGate.hidden = true;
      authGate.removeAttribute("aria-modal");
    }
    document.body.classList.remove("auth-gate-active");
    if (authLoggedOutEl) authLoggedOutEl.hidden = false;
    if (authAdminStepEl) authAdminStepEl.hidden = true;
  }

  function updateAuthUI(user) {
    var mainApp = document.getElementById("main-app");
    var li = document.getElementById("auth-logged-in");
    var nameEl = document.getElementById("auth-user-name");
    var emailEl = document.getElementById("auth-user-email");
    var sessionStartedEl = document.getElementById("auth-session-started");

    if (!user) {
      if (mainApp) {
        mainApp.hidden = true;
        mainApp.setAttribute("aria-hidden", "true");
      }
      if (li) li.style.display = "none";
      adminAuth.clearAdminSession();
      clearAuthSessionTimestamp();
      if (sessionStartedEl) sessionStartedEl.textContent = "";
      showAuthGateStep("google", null);
      updateAuthDomainHint(null);
      return;
    }

    if (!adminAuth.isFullyAuthenticated(user)) {
      if (mainApp) {
        mainApp.hidden = true;
        mainApp.setAttribute("aria-hidden", "true");
      }
      if (li) li.style.display = "none";
      showAuthGateStep("admin", user);
      return;
    }

    hideAuthGate();
    if (mainApp) {
      mainApp.hidden = false;
      mainApp.removeAttribute("aria-hidden");
    }
    if (li) li.style.display = "flex";

    var sess = adminAuth.getAdminSession();
    var displayName = (sess && sess.nombre) || user.displayName || user.email || "Administrador";

    if (nameEl) {
      if (displayName) nameEl.textContent = displayName;
      else nameEl.textContent = "Usuario · " + String(user.uid).slice(0, 12) + "…";
    }
    if (emailEl) {
      var mail = (sess && sess.email) || user.email || "";
      if (mail) {
        emailEl.textContent = mail;
        emailEl.removeAttribute("hidden");
      } else {
        emailEl.textContent = "";
        emailEl.setAttribute("hidden", "");
      }
    }
    ensureAuthSessionTimestamp();
    if (sessionStartedEl) {
      var ms = null;
      try {
        ms = parseInt(sessionStorage.getItem(AUTH_SESSION_START_KEY), 10);
      } catch (e2) {}
      var shown = "";
      if (user.metadata && user.metadata.lastSignInTime) {
        shown = "Inicio de sesión: " + formatAuthSessionStarted(user.metadata.lastSignInTime);
      } else if (ms && !isNaN(ms)) {
        shown = "Sesión desde: " + formatAuthSessionStarted(ms);
      }
      if (sess && sess.rol) shown += (shown ? " · " : "") + "Rol: " + sess.rol;
      sessionStartedEl.textContent = shown;
    }
    hideAuthError();
  }

  function onAdminSubmit() {
    var user = auth.currentUser;
    if (!user) {
      showAdminStepError("Debe iniciar sesión con Google primero.");
      return;
    }
    var email = adminEmailInput ? adminEmailInput.value : "";
    var pass = adminPassInput ? adminPassInput.value : "";
    if (btnAdminSubmit) btnAdminSubmit.disabled = true;
    clearAdminStepError();
    hideAuthError();

    adminAuth
      .authenticateAdmin(email, pass, user)
      .then(function () {
        if (btnAdminSubmit) btnAdminSubmit.disabled = false;
        if (adminPassInput) adminPassInput.value = "";
        handleAuthState(user);
      })
      .catch(function (err) {
        if (btnAdminSubmit) btnAdminSubmit.disabled = false;
        var msg = err && err.message ? err.message : String(err);
        showAdminStepError(msg);
        console.warn("[admin-auth]", msg);
      });
  }

  function googleAuthProvider() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  }

  function startGoogleSignIn() {
    adminAuth.clearAdminSession();
    return auth.signOut().catch(function () {}).then(function () {
      try {
        sessionStorage.removeItem(AUTH_SESSION_START_KEY);
      } catch (e) {}
      var provider = googleAuthProvider();
      return auth.signInWithPopup(provider).catch(function (e) {
        if (
          e.code === "auth/popup-blocked" ||
          e.code === "auth/operation-not-supported-in-this-environment"
        ) {
          return auth.signInWithRedirect(googleAuthProvider());
        }
        throw e;
      });
    });
  }

  function wireGoogleButton() {
    if (!btnGoogleSignin || btnGoogleSignin._luganoWired) return;
    btnGoogleSignin._luganoWired = true;
    btnGoogleSignin.addEventListener("click", function () {
      btnGoogleSignin.disabled = true;
      startGoogleSignIn()
        .then(function () {
          if (btnGoogleSignin) btnGoogleSignin.disabled = false;
        })
        .catch(function (e) {
          if (btnGoogleSignin) btnGoogleSignin.disabled = false;
          console.warn("Google:", e.code, e.message);
          showAuthError(e);
        });
    });
  }

  function wireSignOut() {
    if (!btnSignOut || btnSignOut._luganoWired) return;
    btnSignOut._luganoWired = true;
    btnSignOut.addEventListener("click", function () {
      adminAuth.clearAdminSession();
      auth.signOut().then(function () {
        try {
          sessionStorage.removeItem(AUTH_SESSION_START_KEY);
        } catch (e) {}
        location.reload();
      });
    });
  }

  var initHooks = null;

  function handleAuthState(user) {
    document.documentElement.classList.add("auth-session-ready");
    updateAuthUI(user);
    if (user && btnGoogleSignin) btnGoogleSignin.disabled = false;

    if (adminAuth.isFullyAuthenticated(user)) {
      if (initHooks && typeof initHooks.onFullyAuthed === "function") {
        initHooks.onFullyAuthed(user, adminAuth.getAdminSession());
      }
      try {
        window.dispatchEvent(
          new CustomEvent("lugano-auth-ready", {
            detail: { user: user, admin: adminAuth.getAdminSession() },
          })
        );
      } catch (e) {}
    } else if (!user && initHooks && typeof initHooks.onSignedOut === "function") {
      initHooks.onSignedOut();
    }
  }

  function init(opts) {
    initHooks = (opts && opts.hooks) || null;
    ensureAdminStepMarkup();
    wireGoogleButton();
    wireSignOut();
    updateAuthDomainHint(null);

    if (opts && opts.skipAuthListener) return;

    if (window.location.protocol === "file:") {
      console.warn(
        "Abrir esta página como archivo (file://) puede fallar con Firebase. Usá un servidor local, por ejemplo: npx --yes serve ."
      );
    }

    var authBootFallback = window.setTimeout(function () {
      if (!document.documentElement.classList.contains("auth-session-ready")) {
        handleAuthState(auth.currentUser || null);
      }
    }, 12000);

    auth
      .getRedirectResult()
      .catch(function (e) {
        if (
          e.code &&
          e.code !== "auth/no-auth-event" &&
          e.code !== "auth/missing-or-invalid-nonce"
        ) {
          showAuthError(e);
        }
      });

    auth.onAuthStateChanged(function (user) {
      window.clearTimeout(authBootFallback);
      handleAuthState(user);
    });
  }

  window.LuganoAuthGate = {
    init: init,
    handleAuthState: handleAuthState,
    updateAuthUI: updateAuthUI,
    isFullyAuthenticated: function (user) {
      return adminAuth.isFullyAuthenticated(user || auth.currentUser);
    },
    clearAdminSession: adminAuth.clearAdminSession,
    getAdminSession: adminAuth.getAdminSession,
  };

  if (!window.LUGANO_AUTH_GATE_MANUAL) {
    init();
  }
})();
