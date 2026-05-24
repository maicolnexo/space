/**
 * Cabecera: scroll + botón flecha. La preferencia guardada con la flecha (localStorage)
 * aplica en todas las páginas; el scroll solo fuerza compacto al bajar.
 */
(function () {
  var TOP_ZONE_PX = 14;
  var BANNER_TRANSITION_MS = 520;

  var ATTR_SCROLL_COLLAPSE = "data-site-banner-scroll-collapse";
  var STORAGE_BANNER_PREF = "lugano-header-banner-compact";

  var prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ICON_UP =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>';
  var ICON_DOWN =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /** null = sin elección (solo scroll); true = ocultar cabecera incluso arriba; false = mostrar arriba */
  function getUserBannerPreference() {
    try {
      var v = localStorage.getItem(STORAGE_BANNER_PREF);
      if (v === null) return null;
      return v === "1";
    } catch (e) {
      return null;
    }
  }

  function persistUserBannerPreference(compact) {
    try {
      localStorage.setItem(STORAGE_BANNER_PREF, compact ? "1" : "0");
    } catch (e) {}
  }

  function wantCompactFromScrollAndPref() {
    var y = getScrollY();
    var atTop = y <= TOP_ZONE_PX;
    if (!atTop) return true;
    var pref = getUserBannerPreference();
    if (pref === true) return true;
    return false;
  }

  function styleToggleButton(btn, compact) {
    btn.classList.toggle("site-header-collapse-toggle--banner-hidden", !!compact);
  }

  function findSiteHeaders() {
    var out = [];
    document.querySelectorAll("header").forEach(function (h) {
      if (h.querySelector("table .btnmnini")) out.push(h);
    });
    return out;
  }

  function getBannerRow(header) {
    return header.querySelector("table tr:first-child");
  }

  function getScrollY() {
    return (
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0
    );
  }

  function applyCompact(header, compact) {
    header.classList.toggle("site-header--compact", !!compact);
  }

  function syncButton(btn, compact, scrolledAwayFromTop) {
    btn.setAttribute("aria-expanded", compact ? "false" : "true");
    styleToggleButton(btn, compact);
    if (scrolledAwayFromTop) {
      btn.setAttribute("aria-label", "Subir al inicio y mostrar cabecera completa");
      btn.innerHTML = ICON_DOWN;
    } else {
      btn.setAttribute(
        "aria-label",
        compact ? "Expandir encabezado" : "Contraer encabezado"
      );
      btn.innerHTML = compact ? ICON_DOWN : ICON_UP;
    }
  }

  function stripBannerVisualClasses(header) {
    header.classList.remove("site-header--banner-hiding");
    header.classList.remove("site-header--banner-animating");
    var row = getBannerRow(header);
    if (row) {
      row.querySelectorAll("td").forEach(function (td) {
        td.style.transition = "";
        td.style.opacity = "";
      });
    }
  }

  function cancelHideAnimation(header, btn) {
    header.removeAttribute(ATTR_SCROLL_COLLAPSE);
    stripBannerVisualClasses(header);
    if (btn && getScrollY() <= TOP_ZONE_PX) {
      syncButton(btn, false, false);
    }
  }

  function snapFinishCollapse(header, btn) {
    header.removeAttribute(ATTR_SCROLL_COLLAPSE);
    stripBannerVisualClasses(header);
    applyCompact(header, true);
    if (btn) syncButton(btn, true, getScrollY() > TOP_ZONE_PX);
  }

  function animateCollapseBanner(header, btn, fromScroll) {
    if (prefersReduced) {
      stripBannerVisualClasses(header);
      applyCompact(header, true);
      if (btn) syncButton(btn, true, getScrollY() > TOP_ZONE_PX);
      if (!fromScroll) persistUserBannerPreference(true);
      return;
    }

    if (
      header.classList.contains("site-header--compact") ||
      header.classList.contains("site-header--banner-hiding")
    ) {
      return;
    }

    var row = getBannerRow(header);
    if (!row) {
      applyCompact(header, true);
      if (btn) syncButton(btn, true, getScrollY() > TOP_ZONE_PX);
      if (!fromScroll) persistUserBannerPreference(true);
      return;
    }

    if (fromScroll) {
      header.setAttribute(ATTR_SCROLL_COLLAPSE, "1");
    }

    stripBannerVisualClasses(header);
    header.classList.add("site-header--banner-animating");
    header.classList.add("site-header--banner-hiding");

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      header.removeAttribute(ATTR_SCROLL_COLLAPSE);
      header.classList.remove("site-header--banner-hiding");
      header.classList.add("site-header--compact");
      header.classList.remove("site-header--banner-animating");
      if (btn) syncButton(btn, true, getScrollY() > TOP_ZONE_PX);
      if (!fromScroll) persistUserBannerPreference(true);
    }

    window.setTimeout(finish, BANNER_TRANSITION_MS);
  }

  function animateExpandBanner(header, btn, saveUserPreference) {
    if (prefersReduced) {
      stripBannerVisualClasses(header);
      applyCompact(header, false);
      if (btn) syncButton(btn, false, false);
      if (saveUserPreference) persistUserBannerPreference(false);
      return;
    }

    stripBannerVisualClasses(header);

    if (!header.classList.contains("site-header--compact")) {
      if (btn) syncButton(btn, false, getScrollY() > TOP_ZONE_PX);
      return;
    }

    applyCompact(header, false);

    var row = getBannerRow(header);
    if (!row) {
      if (btn) syncButton(btn, false, false);
      if (saveUserPreference) persistUserBannerPreference(false);
      return;
    }

    var tds = row.querySelectorAll("td");
    tds.forEach(function (td) {
      td.style.transition = "none";
      td.style.opacity = "0";
    });
    void row.offsetHeight;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var ease = "cubic-bezier(0.22, 1, 0.36, 1)";
        tds.forEach(function (td) {
          td.style.transition = "opacity 0.52s " + ease;
          td.style.opacity = "1";
        });

        window.setTimeout(function () {
          tds.forEach(function (td) {
            td.style.transition = "";
            td.style.opacity = "";
          });
          if (btn) syncButton(btn, false, getScrollY() > TOP_ZONE_PX);
          if (saveUserPreference) persistUserBannerPreference(false);
        }, BANNER_TRANSITION_MS);
      });
    });
  }

  function updateHeadersFromScroll() {
    var y = getScrollY();
    var atTop = y <= TOP_ZONE_PX;
    var wantCompact = wantCompactFromScrollAndPref();

    findSiteHeaders().forEach(function (header) {
      var btn = header.querySelector(".site-header-collapse-toggle");
      var hasCompact = header.classList.contains("site-header--compact");
      var hasHiding = header.classList.contains("site-header--banner-hiding");

      if (prefersReduced) {
        stripBannerVisualClasses(header);
        applyCompact(header, wantCompact);
        if (btn) syncButton(btn, wantCompact, !atTop);
        return;
      }

      if (!wantCompact) {
        if (hasHiding) {
          if (header.getAttribute(ATTR_SCROLL_COLLAPSE) === "1") {
            cancelHideAnimation(header, btn);
          }
        } else if (hasCompact) {
          animateExpandBanner(header, btn, false);
        } else if (btn) {
          syncButton(btn, false, false);
        }
        return;
      }

      if (
        hasHiding &&
        !hasCompact &&
        header.getAttribute(ATTR_SCROLL_COLLAPSE) !== "1"
      ) {
        snapFinishCollapse(header, btn);
        return;
      }

      if (!hasCompact && !hasHiding) {
        animateCollapseBanner(header, btn, true);
      } else if (btn) {
        syncButton(btn, true, !atTop);
      }
    });
  }

  var scrollTicking = false;
  function onScrollOrResize() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      scrollTicking = false;
      updateHeadersFromScroll();
    });
  }

  function onStorageEvent(ev) {
    if (ev.key !== STORAGE_BANNER_PREF) return;
    updateHeadersFromScroll();
  }

  function attach(header) {
    if (header.querySelector(".site-header-collapse-toggle")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "site-header-collapse-toggle";

    btn.addEventListener("click", function () {
      var y = getScrollY();
      if (y > TOP_ZONE_PX) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (header.classList.contains("site-header--banner-hiding")) {
        cancelHideAnimation(header, btn);
        return;
      }

      var compactNow = header.classList.contains("site-header--compact");
      if (compactNow) {
        animateExpandBanner(header, btn, true);
      } else {
        animateCollapseBanner(header, btn, false);
      }
    });

    var wrap = document.createElement("div");
    wrap.className = "site-header-controls";
    wrap.appendChild(btn);

    var table = header.querySelector("table");
    var menuRow =
      table && table.rows.length >= 2 ? table.rows[table.rows.length - 1] : null;

    if (menuRow && menuRow.querySelector(".btnmnini")) {
      var td = document.createElement("td");
      td.className = "site-header-collapse-cell";
      td.appendChild(wrap);
      menuRow.appendChild(td);
    } else {
      wrap.classList.add("site-header-controls--floating");
      header.insertBefore(wrap, header.firstChild);
    }
  }

  function init() {
    findSiteHeaders().forEach(attach);
    if (getUserBannerPreference() === true) {
      findSiteHeaders().forEach(function (header) {
        var btn = header.querySelector(".site-header-collapse-toggle");
        stripBannerVisualClasses(header);
        applyCompact(header, true);
        if (btn) syncButton(btn, true, getScrollY() > TOP_ZONE_PX);
      });
    }
    document.documentElement.classList.remove("lugano-banner-hidden-ssr");
    updateHeadersFromScroll();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("storage", onStorageEvent);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
