/* Oculta el banner antes del primer pintado si la preferencia ya es «cabecera oculta» (evita flash). */
(function () {
  try {
    if (localStorage.getItem("lugano-header-banner-compact") === "1") {
      document.documentElement.classList.add("lugano-banner-hidden-ssr");
    }
  } catch (e) {}
})();
