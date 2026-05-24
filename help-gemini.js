// Botón Gemini en ayuda.html (sin navegación interna)
(function () {
  var btn = document.getElementById("help-gemini-fab");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var url = "https://gemini.google.com/app";
    var w = Math.min(980, Math.max(420, Math.floor(window.innerWidth * 0.72)));
    var h = Math.min(820, Math.max(520, Math.floor(window.innerHeight * 0.78)));
    var left = Math.max(0, Math.floor((window.screenX || 0) + (window.outerWidth - w) / 2));
    var top = Math.max(0, Math.floor((window.screenY || 0) + (window.outerHeight - h) / 2));
    var features =
      "popup=yes" +
      ",noopener=yes,noreferrer=yes" +
      ",width=" + w +
      ",height=" + h +
      ",left=" + left +
      ",top=" + top +
      ",resizable=yes,scrollbars=yes";

    var win = window.open(url, "lugano_gemini_popup", features);
    if (!win) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try { win.focus(); } catch (e) {}
  });
})();

