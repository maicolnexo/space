/**
 * Entradas de ayuda definidas por el usuario (localStorage).
 * Complementa ayuda.html sin backend; el asistente lee las mismas entradas.
 */
(function () {
  var STORAGE_KEY = "lugano-help-custom-v1";
  var MAX_TOPIC = 140;
  var MAX_Q = 260;
  var MAX_A = 16000;

  function uid() {
    return (
      "hc" +
      Date.now().toString(36) +
      Math.random().toString(36).replace(/[^a-z0-9]+/g, "").slice(0, 6)
    );
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function clamp(s, n) {
    s = String(s == null ? "" : s).trim();
    return s.length > n ? s.slice(0, n) : s;
  }

  function normalizeImportedRow(obj) {
    if (!obj || typeof obj !== "object") return null;
    var topic =
      clamp(obj.tema != null ? obj.tema : obj.topic, MAX_TOPIC) ||
      clamp(obj.section, MAX_TOPIC);
    var question = clamp(
      obj.pregunta != null ? obj.pregunta : obj.question,
      MAX_Q
    );
    var answer = clamp(
      obj.respuesta != null ? obj.respuesta : obj.answer,
      MAX_A
    );
    if (!question || !answer) return null;
    return {
      id: typeof obj.id === "string" ? obj.id : uid(),
      tema: topic,
      pregunta: question,
      respuesta: answer,
      creado:
        typeof obj.creado === "number" ? obj.creado : Date.now(),
    };
  }

  function notifyChanged() {
    document.dispatchEvent(new CustomEvent("lugano-help-custom-changed"));
  }

  function renderFaq(root) {
    var list = load();
    root.textContent = "";

    var sec = document.createElement("section");
    sec.className = "help-section help-section--custom";
    sec.id = "ayuda-personalizada";

    var h2 = document.createElement("h2");
    h2.appendChild(document.createTextNode("Entradas añadidas manualmente "));
    var tag = document.createElement("span");
    tag.className = "help-custom-tag";
    tag.textContent = "este navegador";
    h2.appendChild(tag);
    sec.appendChild(h2);

    if (!list.length) {
      var p = document.createElement("p");
      p.className = "help-custom-empty";
      p.textContent =
        "Aún no hay entradas personalizadas. Despliegue el formulario anterior, rellene la pregunta y la respuesta, y pulse Guardar entrada.";
      sec.appendChild(p);
      root.appendChild(sec);
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "help-faq";

    list.forEach(function (e) {
      var det = document.createElement("details");
      var sum = document.createElement("summary");
      sum.textContent = e.pregunta;
      det.appendChild(sum);

      var ans = document.createElement("div");
      ans.className = "help-answer";
      if (e.tema && e.tema.trim()) {
        var line = document.createElement("p");
        line.className = "help-custom-topicline";
        var b = document.createElement("strong");
        b.textContent = "Tema: ";
        line.appendChild(b);
        line.appendChild(document.createTextNode(e.tema.trim()));
        ans.appendChild(line);
      }
      var body = document.createElement("p");
      body.style.whiteSpace = "pre-wrap";
      body.textContent = e.respuesta;
      ans.appendChild(body);
      det.appendChild(ans);
      wrap.appendChild(det);
    });

    sec.appendChild(wrap);
    root.appendChild(sec);
  }

  function renderList(listEl) {
    var list = load();
    listEl.textContent = "";

    if (!list.length) return;

    list.forEach(function (e) {
      var li = document.createElement("li");
      li.className = "help-custom-list-item";

      var text = document.createElement("div");
      text.className = "help-custom-list-item-text";
      var strong = document.createElement("strong");
      strong.textContent = e.pregunta;
      text.appendChild(strong);
      if (e.tema && e.tema.trim()) {
        text.appendChild(
          document.createTextNode(" · " + e.tema.trim())
        );
      }

      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "help-custom-list-remove";
      rm.setAttribute("data-id", e.id);
      rm.setAttribute("aria-label", "Eliminar esta entrada");
      rm.textContent = "Eliminar";

      li.appendChild(text);
      li.appendChild(rm);
      listEl.appendChild(li);
    });
  }

  function init() {
    var mainApp = document.getElementById("main-app");
    var root = document.getElementById("help-custom-faq-root");
    var listEl = document.getElementById("help-custom-list");
    var topicIn = document.getElementById("help-custom-topic");
    var qIn = document.getElementById("help-custom-question");
    var aIn = document.getElementById("help-custom-answer");
    var saveBtn = document.getElementById("help-custom-save");
    var exportBtn = document.getElementById("help-custom-export");
    var impTrigger = document.getElementById("help-custom-import-trigger");
    var impBox = document.getElementById("help-custom-import-box");
    var impText = document.getElementById("help-custom-import-text");
    var impApply = document.getElementById("help-custom-import-apply");

    if (!mainApp || !root || !listEl || !saveBtn) return;

    function redraw() {
      renderFaq(root);
      renderList(listEl);
      notifyChanged();
    }

    redraw();

    saveBtn.addEventListener("click", function () {
      var topic = clamp(topicIn.value, MAX_TOPIC);
      var question = clamp(qIn.value, MAX_Q);
      var answer = clamp(aIn.value, MAX_A);
      if (!question || !answer) {
        window.alert("Indique la pregunta y la respuesta antes de guardar.");
        return;
      }
      var list = load();
      list.push({
        id: uid(),
        tema: topic,
        pregunta: question,
        respuesta: answer,
        creado: Date.now(),
      });
      save(list);
      qIn.value = "";
      aIn.value = "";
      redraw();
    });

    listEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button.help-custom-list-remove");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var list = load().filter(function (x) {
        return x.id !== id;
      });
      save(list);
      redraw();
    });

    exportBtn.addEventListener("click", function () {
      var list = load();
      var json = JSON.stringify(
        list.map(function (e) {
          return {
            tema: e.tema,
            pregunta: e.pregunta,
            respuesta: e.respuesta,
          };
        }),
        null,
        2
      );
      try {
        navigator.clipboard.writeText(json).then(
          function () {
            window.alert(
              "Lista copiada al portapapeles (formato JSON). Péguela en un archivo de texto para respaldarla."
            );
          },
          function () {
            window.prompt("Copie este texto y guárdelo:", json);
          }
        );
      } catch (err) {
        window.prompt("Copie este texto y guárdelo:", json);
      }
    });

    impTrigger.addEventListener("click", function () {
      impBox.hidden = !impBox.hidden;
    });

    impApply.addEventListener("click", function () {
      var raw = String(impText.value || "").trim();
      if (!raw) {
        window.alert("Pegue antes un JSON válido.");
        return;
      }
      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        window.alert("El JSON no es válido. Revise comillas y corchetes.");
        return;
      }
      if (!Array.isArray(data)) {
        window.alert("Se espera una lista (array) de entradas.");
        return;
      }
      var merged = load();
      var added = 0;
      data.forEach(function (row) {
        var n = normalizeImportedRow(row);
        if (!n) return;
        merged.push(n);
        added++;
      });
      if (!added) {
        window.alert(
          "No se importó ninguna fila. Cada objeto necesita pregunta y respuesta (o question/answer)."
        );
        return;
      }
      save(merged);
      impText.value = "";
      impBox.hidden = true;
      redraw();
      window.alert(
        "Se añadieron " + added + " entrada(s). Las anteriores en el navegador se conservan."
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
