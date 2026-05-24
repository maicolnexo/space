/**
 * Campana de alertas del sistema junto a Ayuda (todas las páginas con menú).
 * API global: LuganoAlerts.setSystemAlertCount(n), LuganoAlerts.openSystemAlerts()
 */
(function (global) {
  var BELL_ICON =
    '<svg class="lugano-bell-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  var systemCount = 0;
  var systemItems = [];

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateSystemBadge() {
    var badge = document.getElementById("lugano-header-alerts-badge");
    if (!badge) return;
    if (systemCount > 0) {
      badge.hidden = false;
      badge.textContent = systemCount > 99 ? "99+" : String(systemCount);
    } else {
      badge.hidden = true;
      badge.textContent = "";
    }
  }

  function renderSystemAlertsList() {
    var list = document.getElementById("lugano-system-alerts-list");
    var empty = document.getElementById("lugano-system-alerts-empty");
    if (!list || !empty) return;
    if (!systemItems.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = systemItems
      .map(function (item) {
        if (
          item.esSolicitudOperario &&
          item.alertId &&
          global.LuganoFirestoreAlertas &&
          typeof global.LuganoFirestoreAlertas.buildSolicitudListItemHtml === "function"
        ) {
          return global.LuganoFirestoreAlertas.buildSolicitudListItemHtml(item, escapeHtml);
        }
        var tipo = item.tipoLabel || item.tipo || "";
        var op = item.operarioNombre || "";
        return (
          '<li class="lugano-alerts-item">' +
          (op ? '<strong class="lugano-alerts-op">' + escapeHtml(op) + "</strong>" : "") +
          (tipo
            ? '<span class="lugano-alerts-tipo">' + escapeHtml(tipo) + "</span>"
            : "") +
          "<span>" +
          escapeHtml(item.text || item.message || "") +
          "</span>" +
          (item.time ? "<time>" + escapeHtml(item.time) + "</time>" : "") +
          "</li>"
        );
      })
      .join("");
  }

  function closeSystemAlerts() {
    var dlg = document.getElementById("lugano-system-alerts-dialog");
    if (dlg) {
      dlg.hidden = true;
      dlg.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("lugano-alerts-dialog-open");
  }

  function openSystemAlerts() {
    ensureSystemAlertsDialog();
    var dlg = document.getElementById("lugano-system-alerts-dialog");
    if (!dlg) return;
    renderSystemAlertsList();
    dlg.hidden = false;
    dlg.setAttribute("aria-hidden", "false");
    document.body.classList.add("lugano-alerts-dialog-open");
    var closeBtn = dlg.querySelector(".lugano-alerts-close");
    if (closeBtn) closeBtn.focus();
  }

  function ensureSystemAlertsDialog() {
    if (document.getElementById("lugano-system-alerts-dialog")) return;
    var wrap = document.createElement("div");
    wrap.id = "lugano-system-alerts-dialog";
    wrap.className = "lugano-alerts-dialog";
    wrap.hidden = true;
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML =
      '<div class="lugano-alerts-backdrop" data-lugano-alerts-close></div>' +
      '<div class="lugano-alerts-panel" role="dialog" aria-modal="true" aria-labelledby="lugano-system-alerts-title">' +
      '<header class="lugano-alerts-head">' +
      '<h3 id="lugano-system-alerts-title">' +
      BELL_ICON +
      " Alertas del sistema</h3>" +
      '<button type="button" class="lugano-alerts-close" aria-label="Cerrar">×</button>' +
      "</header>" +
      '<div class="lugano-alerts-body">' +
      '<p id="lugano-system-alerts-empty" class="lugano-alerts-empty">' +
      "No hay alertas pendientes del sistema." +
      "</p>" +
      '<ul id="lugano-system-alerts-list" class="lugano-alerts-list"></ul>' +
      "</div></div>";
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-lugano-alerts-close]").forEach(function (el) {
      el.addEventListener("click", closeSystemAlerts);
    });
    var closeBtn = wrap.querySelector(".lugano-alerts-close");
    if (closeBtn) closeBtn.addEventListener("click", closeSystemAlerts);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && wrap && !wrap.hidden) closeSystemAlerts();
    });
  }

  function initHeaderBell() {
    var ayuda = document.getElementById("ayuda");
    if (!ayuda || document.getElementById("lugano-header-alerts-cell")) return;
    var td = document.createElement("td");
    td.id = "lugano-header-alerts-cell";
    td.className = "lugano-header-alerts-cell";
    td.setAttribute("width", "52");
    var center = document.createElement("center");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lugano-bell-btn lugano-bell-btn--header";
    btn.id = "lugano-header-alerts-btn";
    btn.setAttribute("aria-label", "Alertas del sistema");
    btn.title = "Alertas del sistema";
    btn.innerHTML =
      BELL_ICON +
      '<span class="lugano-bell-badge" id="lugano-header-alerts-badge" hidden></span>';
    btn.addEventListener("click", openSystemAlerts);
    center.appendChild(btn);
    td.appendChild(center);
    if (ayuda.nextSibling) {
      ayuda.parentNode.insertBefore(td, ayuda.nextSibling);
    } else {
      ayuda.parentNode.appendChild(td);
    }
    var header = ayuda.closest("header");
    if (header) {
      var bannerTd = header.querySelector("table tr:first-child td[colspan]");
      if (bannerTd) {
        var n = parseInt(bannerTd.getAttribute("colspan"), 10) || 11;
        bannerTd.setAttribute("colspan", String(n + 1));
      }
    }
  }

  function setSystemAlertCount(n) {
    systemCount = Math.max(0, parseInt(n, 10) || 0);
    updateSystemBadge();
  }

  function setSystemAlerts(items) {
    systemItems = Array.isArray(items) ? items.slice() : [];
    systemCount = systemItems.length;
    updateSystemBadge();
    renderSystemAlertsList();
  }

  function init() {
    ensureSystemAlertsDialog();
    initHeaderBell();
    updateSystemBadge();
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-prog-sol-action]");
      if (!btn || !btn.closest("#lugano-system-alerts-list")) return;
      if (global.ProgSolicitudAcciones && typeof global.ProgSolicitudAcciones.onAction === "function") {
        global.ProgSolicitudAcciones.onAction(btn);
      }
    });
  }

  global.LuganoAlerts = global.LuganoAlerts || {};
  global.LuganoAlerts.bellIcon = BELL_ICON;
  global.LuganoAlerts.setSystemAlertCount = setSystemAlertCount;
  global.LuganoAlerts.setSystemAlerts = setSystemAlerts;
  global.LuganoAlerts.openSystemAlerts = openSystemAlerts;
  global.LuganoAlerts.closeSystemAlerts = closeSystemAlerts;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
