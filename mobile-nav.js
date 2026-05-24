/**
 * Menú desplegable en cabecera para móvil (≤900px).
 * Construye el panel a partir de los enlaces .btnmnini existentes.
 */
(function () {
  var MQ = window.matchMedia("(max-width: 900px)");
  var navIdCounter = 0;

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

  function collectNavLinks(header) {
    var links = [];
    header.querySelectorAll("table .btnmnini").forEach(function (a) {
      if (!a.href) return;
      var label =
        (a.querySelector("span") && a.querySelector("span").textContent.trim()) ||
        a.textContent.trim() ||
        a.getAttribute("title") ||
        "Enlace";
      links.push({
        href: a.href,
        label: label,
        id: a.id || "",
        active: linkPath(a.getAttribute("href")) === pagePath(),
      });
    });
    return links;
  }

  function closeMenu(wrap) {
    if (!wrap) return;
    var btn = wrap.querySelector(".space-mobile-nav__toggle");
    var menu = wrap.querySelector(".space-mobile-nav__menu");
    wrap.classList.remove("is-open");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
    }
    if (menu) {
      menu.hidden = true;
    }
  }

  function openMenu(wrap) {
    if (!wrap) return;
    var btn = wrap.querySelector(".space-mobile-nav__toggle");
    var menu = wrap.querySelector(".space-mobile-nav__menu");
    wrap.classList.add("is-open");
    if (btn) {
      btn.setAttribute("aria-expanded", "true");
    }
    if (menu) {
      menu.hidden = false;
    }
  }

  function toggleMenu(wrap) {
    if (wrap.classList.contains("is-open")) {
      closeMenu(wrap);
    } else {
      openMenu(wrap);
    }
  }

  function buildMobileNav(header) {
    if (header.querySelector(".space-mobile-nav")) return;

    var links = collectNavLinks(header);
    if (!links.length) return;

    navIdCounter += 1;
    var menuId = "space-mobile-nav-menu-" + navIdCounter;

    var wrap = document.createElement("div");
    wrap.className = "space-mobile-nav";

    var bar = document.createElement("div");
    bar.className = "space-mobile-nav__bar";

    var brand = document.createElement("a");
    brand.className = "space-mobile-nav__brand";
    brand.href = "index.html";
    brand.textContent = "S.P.A.C.E";

    var actions = document.createElement("div");
    actions.className = "space-mobile-nav__actions";

    var existingControls = header.querySelector(".site-header-controls");
    if (existingControls) {
      actions.appendChild(existingControls);
    }

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "space-mobile-nav__toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", menuId);
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    toggle.innerHTML =
      '<span class="space-mobile-nav__toggle-icon" aria-hidden="true"></span>' +
      '<span class="space-mobile-nav__toggle-text">Menú</span>';

    actions.appendChild(toggle);
    bar.appendChild(brand);
    bar.appendChild(actions);

    var menu = document.createElement("nav");
    menu.id = menuId;
    menu.className = "space-mobile-nav__menu";
    menu.hidden = true;
    menu.setAttribute("aria-label", "Navegación principal");

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

    menu.appendChild(list);
    wrap.appendChild(bar);
    wrap.appendChild(menu);
    header.insertBefore(wrap, header.firstChild);

    toggle.addEventListener("click", function (ev) {
      ev.stopPropagation();
      toggleMenu(wrap);
    });

    document.addEventListener("click", function (ev) {
      if (!wrap.classList.contains("is-open")) return;
      if (wrap.contains(ev.target)) return;
      closeMenu(wrap);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeMenu(wrap);
    });
  }

  function teardownUnused(header) {
    var wrap = header.querySelector(".space-mobile-nav");
    if (!wrap) return;
    if (isMobile()) return;
    closeMenu(wrap);
  }

  function initAll() {
    document.querySelectorAll("header").forEach(function (header) {
      if (!header.querySelector("table .btnmnini")) return;
      if (isMobile()) {
        buildMobileNav(header);
      } else {
        teardownUnused(header);
      }
    });
  }

  function onMqChange() {
    initAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  if (typeof MQ.addEventListener === "function") {
    MQ.addEventListener("change", onMqChange);
  } else if (typeof MQ.addListener === "function") {
    MQ.addListener(onMqChange);
  }

  window.addEventListener("resize", function () {
    if (!isMobile()) {
      document.querySelectorAll("header .space-mobile-nav").forEach(closeMenu);
    }
  });
})();
