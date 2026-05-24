/**
 * Menú desplegable en cabecera para móvil (≤900px).
 */
(function () {
  var MQ = window.matchMedia("(max-width: 900px)");
  var navIdCounter = 0;
  var BODY_OPEN = "space-mobile-nav-open";

  function isMobile() {
    return MQ.matches;
  }

  function pagePath() {
    try {
      var p = window.location.pathname || "";
      var parts = p.split("/");
      return (parts[parts.length - 1] || "index.html").toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function linkPath(href) {
    if (!href) return "";
    try {
      var u = new URL(href, window.location.href);
      var parts = u.pathname.split("/");
      return (parts[parts.length - 1] || "").toLowerCase();
    } catch (e) {
      return String(href).split("?")[0].split("#")[0].toLowerCase();
    }
  }

  function cleanPageTitle(raw) {
    var t = String(raw || "")
      .replace(/\s*[—–-]\s*panel.*$/i, "")
      .replace(/\s*[·•]\s*S\.?P\.?A\.?C\.?E.*$/i, "")
      .replace(/\s*·\s*.*$/i, "")
      .trim();
    if (t.length > 42) t = t.slice(0, 40) + "…";
    return t || "S.P.A.C.E";
  }

  function headerPageTitle(header) {
    var h1 = header.querySelector("table tr:first-child h1");
    if (h1 && h1.textContent.trim()) {
      return cleanPageTitle(h1.textContent.trim());
    }
    return "S.P.A.C.E";
  }

  function headerLogoSrc(header) {
    var img = header.querySelector("table td[rowspan] img, table td[rowspan='2'] img");
    return img && img.getAttribute("src") ? img.getAttribute("src") : "logolugano1.jpg";
  }

  function collectNavLinks(header) {
    var links = [];
    header.querySelectorAll("table .btnmnini").forEach(function (a) {
      if (!a.href) return;
      var label =
        (a.querySelector("span") && a.querySelector("span").textContent.trim()) ||
        a.textContent.trim() ||
        a.getAttribute("title") ||
        "Enlace";
      label = label.charAt(0).toUpperCase() + label.slice(1);
      links.push({
        href: a.href,
        label: label,
        id: a.id || "",
        active: linkPath(a.getAttribute("href")) === pagePath(),
      });
    });
    return links;
  }

  function setMenuTop(wrap) {
    var bar = wrap.querySelector(".space-mobile-nav__bar");
    if (!bar) return;
    var rect = bar.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--space-mobile-nav-top",
      Math.ceil(rect.bottom) + "px"
    );
  }

  function closeMenu(wrap) {
    if (!wrap) return;
    var btn = wrap.querySelector(".space-mobile-nav__toggle");
    var menu = wrap.querySelector(".space-mobile-nav__menu");
    var backdrop = wrap.querySelector(".space-mobile-nav__backdrop");
    wrap.classList.remove("is-open");
    document.documentElement.classList.remove(BODY_OPEN);
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Abrir menú de navegación");
    }
    if (menu) menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }

  function openMenu(wrap) {
    if (!wrap) return;
    setMenuTop(wrap);
    var btn = wrap.querySelector(".space-mobile-nav__toggle");
    var menu = wrap.querySelector(".space-mobile-nav__menu");
    var backdrop = wrap.querySelector(".space-mobile-nav__backdrop");
    wrap.classList.add("is-open");
    document.documentElement.classList.add(BODY_OPEN);
    if (btn) {
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Cerrar menú de navegación");
    }
    if (menu) menu.hidden = false;
    if (backdrop) backdrop.hidden = false;
  }

  function toggleMenu(wrap) {
    if (wrap.classList.contains("is-open")) {
      closeMenu(wrap);
    } else {
      openMenu(wrap);
    }
  }

  function ensureAlertsSlot(actions) {
    var slot = actions.querySelector(".space-mobile-nav__alerts-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "space-mobile-nav__alerts-slot";
      actions.insertBefore(slot, actions.firstChild);
    }
    return slot;
  }

  function relocateAlertsButton(actions) {
    if (!actions) return;
    var btn = document.getElementById("lugano-header-alerts-btn");
    if (!btn) return;
    var slot = ensureAlertsSlot(actions);
    if (btn.parentElement !== slot) {
      slot.appendChild(btn);
    }
    btn.classList.add("lugano-bell-btn--mobile-bar");
  }

  function buildMobileNav(header) {
    if (header.querySelector(".space-mobile-nav")) return;

    var links = collectNavLinks(header);
    if (!links.length) return;

    navIdCounter += 1;
    var menuId = "space-mobile-nav-menu-" + navIdCounter;
    var pageTitle = headerPageTitle(header);
    var logoSrc = headerLogoSrc(header);

    var wrap = document.createElement("div");
    wrap.className = "space-mobile-nav";

    var bar = document.createElement("div");
    bar.className = "space-mobile-nav__bar";

    var brand = document.createElement("a");
    brand.className = "space-mobile-nav__brand";
    brand.href = "index.html";

    var logo = document.createElement("img");
    logo.className = "space-mobile-nav__logo";
    logo.src = logoSrc;
    logo.alt = "S.P.A.C.E";
    logo.width = 44;
    logo.height = 44;
    logo.decoding = "async";

    var titles = document.createElement("div");
    titles.className = "space-mobile-nav__titles";
    titles.innerHTML =
      '<span class="space-mobile-nav__site">S.P.A.C.E</span>' +
      '<span class="space-mobile-nav__page"></span>';
    titles.querySelector(".space-mobile-nav__page").textContent = pageTitle;

    brand.appendChild(logo);
    brand.appendChild(titles);

    var actions = document.createElement("div");
    actions.className = "space-mobile-nav__actions";
    ensureAlertsSlot(actions);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "space-mobile-nav__toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", menuId);
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    toggle.innerHTML =
      '<span class="space-mobile-nav__toggle-icon" aria-hidden="true"></span>';

    actions.appendChild(toggle);
    bar.appendChild(brand);
    bar.appendChild(actions);

    var backdrop = document.createElement("div");
    backdrop.className = "space-mobile-nav__backdrop";
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");

    var menu = document.createElement("nav");
    menu.id = menuId;
    menu.className = "space-mobile-nav__menu";
    menu.hidden = true;
    menu.setAttribute("aria-label", "Navegación principal");

    var menuHead = document.createElement("div");
    menuHead.className = "space-mobile-nav__menu-head";
    menuHead.innerHTML = "<span>Navegación</span>";

    var list = document.createElement("ul");
    list.className = "space-mobile-nav__list";

    links.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      if (item.id) a.id = "mobile-nav-" + item.id;
      if (item.active) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      }
      a.addEventListener("click", function () {
        closeMenu(wrap);
      });
      li.appendChild(a);
      list.appendChild(li);
    });

    menu.appendChild(menuHead);
    menu.appendChild(list);
    wrap.appendChild(bar);
    wrap.appendChild(backdrop);
    wrap.appendChild(menu);
    header.insertBefore(wrap, header.firstChild);

    toggle.addEventListener("click", function (ev) {
      ev.stopPropagation();
      toggleMenu(wrap);
    });

    backdrop.addEventListener("click", function () {
      closeMenu(wrap);
    });

    document.addEventListener("click", function (ev) {
      if (!wrap.classList.contains("is-open")) return;
      if (wrap.contains(ev.target)) return;
      closeMenu(wrap);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeMenu(wrap);
    });

    window.addEventListener(
      "resize",
      function () {
        if (wrap.classList.contains("is-open")) setMenuTop(wrap);
      },
      { passive: true }
    );

    relocateAlertsButton(actions);
  }

  function initAll() {
    document.querySelectorAll("header").forEach(function (header) {
      if (!header.querySelector("table .btnmnini")) return;
      if (isMobile()) {
        buildMobileNav(header);
        var actions = header.querySelector(".space-mobile-nav__actions");
        relocateAlertsButton(actions);
      } else {
        var wrap = header.querySelector(".space-mobile-nav");
        if (wrap) closeMenu(wrap);
      }
    });
  }

  function onMqChange() {
    initAll();
  }

  function afterDeferredScripts() {
    initAll();
    document.querySelectorAll(".space-mobile-nav__actions").forEach(relocateAlertsButton);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", afterDeferredScripts);
  } else {
    afterDeferredScripts();
  }

  window.addEventListener("load", afterDeferredScripts);

  if (typeof MQ.addEventListener === "function") {
    MQ.addEventListener("change", onMqChange);
  } else if (typeof MQ.addListener === "function") {
    MQ.addListener(onMqChange);
  }

  window.addEventListener("resize", function () {
    if (!isMobile()) {
      document.documentElement.classList.remove(BODY_OPEN);
      document.querySelectorAll("header .space-mobile-nav").forEach(closeMenu);
    }
  });
})();
