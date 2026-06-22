/**
 * Ajustes ligeros de UX en móvil (opcional; el CSS mobile.css hace el trabajo principal).
 */
(function () {
  var MQ = window.matchMedia("(max-width: 900px)");

  function applyMobileDocClass() {
    document.documentElement.classList.toggle("space-layout-mobile", MQ.matches);
  }

  function setViewportHeight() {
    document.documentElement.style.setProperty(
      "--space-vh",
      window.innerHeight * 0.01 + "px"
    );
  }

  applyMobileDocClass();
  setViewportHeight();

  if (typeof MQ.addEventListener === "function") {
    MQ.addEventListener("change", applyMobileDocClass);
  } else if (typeof MQ.addListener === "function") {
    MQ.addListener(applyMobileDocClass);
  }

  window.addEventListener("resize", setViewportHeight, { passive: true });
  window.addEventListener("orientationchange", setViewportHeight, { passive: true });
})();
