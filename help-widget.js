/**
 * Widget global del asistente.
 * - Se muestra en todas las páginas excepto ayuda.html
 * - No navega: abre el asistente en la pantalla actual
 * - Base de conocimiento: contenido de ayuda.html (fetch + DOMParser)
 */
(function () {
  function isAyudaPage() {
    try {
      var p = (location && location.pathname) ? location.pathname : "";
      return /ayuda\.html$/i.test(p);
    } catch (e) {
      return false;
    }
  }
  if (isAyudaPage()) return;

  var OSO_SRC = "logolugano1.jpg";
  var HELP_URL = "ayuda.html";
  var GEMINI_URL = "https://gemini.google.com/app";

  function openGeminiPopup(textToCopy) {
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

    // Intentar popup. Si el navegador lo bloquea, caer a pestaña nueva.
    var win = window.open(GEMINI_URL, "lugano_gemini_popup", features);
    if (!win) {
      window.open(GEMINI_URL, "_blank", "noopener,noreferrer");
      return;
    }
    try { win.focus(); } catch (e) {}
    if (textToCopy) {
      try {
        navigator.clipboard && navigator.clipboard.writeText(String(textToCopy));
      } catch (e2) {}
    }
  }

  function geminiSvg() {
    // Icono tipo “sparkle” (similar a Gemini, sin depender de assets externos).
    return (
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M12 2.3l1.35 5.1 5.1 1.35-5.1 1.35L12 15.2l-1.35-5.1-5.1-1.35 5.1-1.35L12 2.3z" fill="url(#g)"/>' +
        '<path d="M18.6 12.4l.85 3.2 3.2.85-3.2.85-.85 3.2-.85-3.2-3.2-.85 3.2-.85.85-3.2z" fill="url(#g2)" opacity=".95"/>' +
        '<defs>' +
          '<linearGradient id="g" x1="6" y1="3" x2="18" y2="15" gradientUnits="userSpaceOnUse">' +
            '<stop stop-color="#FFB74D"/><stop offset="0.55" stop-color="#FF9800"/><stop offset="1" stop-color="#E65100"/>' +
          '</linearGradient>' +
          '<linearGradient id="g2" x1="14" y1="10" x2="24" y2="22" gradientUnits="userSpaceOnUse">' +
            '<stop stop-color="#FFB74D"/><stop offset="1" stop-color="#E65100"/>' +
          '</linearGradient>' +
        '</defs>' +
      '</svg>'
    );
  }

  var STOP = {
    el: 1, la: 1, los: 1, las: 1, un: 1, una: 1, unos: 1, unas: 1,
    y: 1, o: 1, u: 1, de: 1, del: 1, al: 1, a: 1, en: 1, con: 1, por: 1, para: 1,
    que: 1, como: 1, es: 1, son: 1, se: 1, su: 1, sus: 1, lo: 1, le: 1, les: 1,
    no: 1, ni: 1, ya: 1, muy: 1, mas: 1, menos: 1, si: 1, asi: 1,
    quien: 1, cuando: 1, donde: 1, cual: 1,
  };

  function stripAccents(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function tokenize(text) {
    var raw = stripAccents(text).replace(/[^a-z0-9ñü\s]/gi, " ");
    return raw.split(/\s+/).filter(function (w) {
      return w.length > 1 && !STOP[w];
    });
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function buildKnowledgeFromDoc(doc) {
    var items = [];
    if (!doc) return items;

    var mainApp = doc.querySelector("#main-app") || doc;

    var lead = mainApp.querySelector(".help-lead");
    if (lead && lead.textContent.trim()) {
      items.push({
        section: "Introducción",
        question: "¿Qué es el centro de ayuda?",
        answer: lead.textContent.replace(/\s+/g, " ").trim(),
        anchor: "",
      });
    }

    mainApp.querySelectorAll(".help-section").forEach(function (sec) {
      var h2 = sec.querySelector("h2");
      var sectionTitle = h2 ? h2.textContent.replace(/\s+/g, " ").trim() : "";
      var anchor = sec.id || "";

      sec.querySelectorAll(".help-faq details").forEach(function (d) {
        var sum = d.querySelector("summary");
        var ans = d.querySelector(".help-answer");
        var q = sum ? sum.textContent.replace(/\s+/g, " ").trim() : "";
        var a = ans ? ans.textContent.replace(/\s+/g, " ").trim() : "";
        if (q && a) {
          items.push({
            section: sectionTitle,
            question: q,
            answer: a,
            anchor: anchor,
          });
        }
      });
    });

    var note = mainApp.querySelector(".help-note");
    if (note && note.textContent.trim()) {
      items.push({
        section: "Incidencias",
        question: "¿Qué registrar ante un problema?",
        answer: note.textContent.replace(/\s+/g, " ").trim(),
        anchor: "",
      });
    }

    return items;
  }

  function expandSynonyms(tokens) {
    var out = tokens.slice();
    var SYN = {
      cerrar: ["cierre", "cierres", "caja", "cajas", "planilla", "planillas"],
      cierre: ["cierres", "caja", "planillas"],
      planilla: ["planillas", "cierre", "cierres"],
      login: ["sesion", "google", "acceso"],
      entrada: ["acceso", "sesion", "inicio"],
      contraseña: ["password", "clave", "operador"],
      operador: ["operators", "usuarios", "usuario"],
      mensualidad: ["mensualidades", "abono", "abonos", "contrato"],
      reporte: ["reportes", "informe", "exportar"],
      estadistica: ["estadistico", "grafica", "grafico", "historico"],
      error: ["fallo", "dominio", "conexion", "internet"],
    };
    tokens.forEach(function (t) {
      var extras = SYN[t];
      if (extras) extras.forEach(function (x) { out.push(x); });
    });
    return out;
  }

  function scoreMessage(tokensExpanded, item) {
    var tQ = stripAccents(item.question).replace(/\s+/g, " ");
    var tA = stripAccents(item.answer).replace(/\s+/g, " ");
    var tS = stripAccents(item.section || "").replace(/\s+/g, " ");
    var blob = " " + tQ + " " + tA + " " + tS + " ";

    var score = 0;
    var seen = {};
    tokensExpanded.forEach(function (t) {
      if (!t || t.length < 2 || STOP[t] || seen[t]) return;
      seen[t] = true;
      var padded = " " + t + " ";
      if ((" " + tQ + " ").indexOf(padded) !== -1) score += 6;
      else if ((" " + tA + " ").indexOf(padded) !== -1) score += 2;
      else if (blob.indexOf(padded) !== -1) score += 1;
    });

    return score;
  }

  function findAnswers(knowledge, userText) {
    var tokens = tokenize(userText);
    if (!tokens.length) return { matches: [], best: 0 };
    var expanded = expandSynonyms(tokens);
    var ranked = knowledge.map(function (item) {
      return { item: item, score: scoreMessage(expanded, item) };
    });
    ranked.sort(function (x, y) { return y.score - x.score; });
    var best = ranked[0] ? ranked[0].score : 0;
    if (best < 2) return { matches: [], best: 0 };
    var matches = [];
    for (var i = 0; i < ranked.length && matches.length < 3; i++) {
      if (ranked[i].score <= 0) continue;
      if (matches.length && ranked[i].score < Math.max(3, best * 0.45)) break;
      matches.push(ranked[i]);
    }
    return { matches: matches, best: best };
  }

  function formatAnswerHtml(results) {
    if (!results.matches.length) return "";
    var parts = [];
    parts.push('<p class="lp-help-lead-in">Encontré esto en la guía:</p>');
    results.matches.forEach(function (entry, idx) {
      var it = entry.item;
      var sec = escapeHtml(it.section || "");
      var q = escapeHtml(it.question || "");
      var a = escapeHtml(it.answer || "");
      var anchor = it.anchor
        ? '<p class="lp-help-anchor"><a href="' + HELP_URL + "#" + escapeHtml(it.anchor) + '" target="_blank" rel="noopener">Ver en la guía</a></p>'
        : "";
      parts.push(
        '<div class="lp-help-hit">' +
          (idx ? '<hr class="lp-help-hit-divider"/>' : "") +
          '<p class="lp-help-hit-meta">' + sec + "</p>" +
          '<p class="lp-help-hit-q">' + q + "</p>" +
          '<p class="lp-help-hit-a">' + a + "</p>" +
          anchor +
        "</div>"
      );
    });
    return parts.join("");
  }

  var convo = { lastTopic: "" };
  function isShortFollowup(text) {
    var t = stripAccents(text).trim();
    if (!t) return false;
    if (t === "si" || t === "sí" || t === "no" || t === "ok" || t === "vale" || t === "listo" || t === "eso") return true;
    var toks = tokenize(text);
    return toks.length > 0 && toks.length <= 2;
  }
  function enrichQueryWithContext(userText) {
    if (!convo.lastTopic) return userText;
    if (!isShortFollowup(userText)) return userText;
    return userText + " " + convo.lastTopic;
  }
  function setTopicFromResults(results) {
    if (!results || !results.matches || !results.matches.length) return;
    var it = results.matches[0].item;
    if (it && it.section) convo.lastTopic = String(it.section || "").trim();
  }

  function mountUi() {
    var host = document.createElement("div");
    host.className = "lp-help-widget";
    host.id = "lp-help-widget";
    host.setAttribute("aria-live", "polite");

    host.innerHTML =
      '<div class="lp-gemini-panel" id="lp-gemini-panel" aria-hidden="true" hidden>' +
        '<div class="lp-gemini-title">' +
          '<span>Consultas con Gemini</span>' +
          '<button type="button" class="lp-gemini-close" id="lp-gemini-close" aria-label="Cerrar">×</button>' +
        '</div>' +
        '<div class="lp-gemini-actions">' +
          '<button type="button" id="lp-gemini-open">Abrir Gemini</button>' +
          '<button type="button" id="lp-gemini-copy">Copiar mi última pregunta</button>' +
        '</div>' +
        '<p class="lp-gemini-note">Se abrirá en una pestaña nueva. Úselo para consultas generales; para dudas del portal, use “Ayuda”.</p>' +
      "</div>" +
      '<div class="lp-help-panel" id="lp-help-panel" role="dialog" aria-hidden="true" aria-label="Asistente de ayuda" hidden>' +
        '<header>' +
          '<h3><img src="' + OSO_SRC + '" alt=""/><span>Oso de ayuda</span></h3>' +
          '<button type="button" class="lp-help-close" id="lp-help-close" aria-label="Cerrar">×</button>' +
        '</header>' +
        '<div class="lp-help-shell">' +
          '<div class="lp-help-messages" id="lp-help-messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
          '<div class="lp-help-composer">' +
            '<textarea id="lp-help-input" rows="2" maxlength="480" placeholder="Escriba su consulta… (ej.: cierre de caja, mensualidades)"></textarea>' +
            '<button type="button" class="lp-help-send" id="lp-help-send">Enviar</button>' +
          '</div>' +
        '</div>' +
        '<p class="lp-help-disclaimer">Responde con base en la guía de ayuda del sitio. No usa IA externa ni modifica datos.</p>' +
      "</div>" +
      '<div class="lp-help-fab-row" aria-label="Accesos rápidos">' +
        '<button type="button" class="lp-help-fab" id="lp-help-fab" aria-label="Abrir asistente" aria-expanded="false" title="Ayuda">' +
          '<img src="' + OSO_SRC + '" alt=""/>' +
        "</button>" +
        '<button type="button" class="lp-gemini-fab" id="lp-gemini-fab" aria-label="Gemini" title="Gemini">' +
          geminiSvg() +
        "</button>" +
      "</div>" +
      '<div class="lp-help-dock">' +
        '<button type="button" class="lp-help-handle" id="lp-help-handle" aria-label="Mostrar botón de ayuda">' +
          '<img src="' + OSO_SRC + '" alt=""/><span>Ayuda</span>' +
        "</button>" +
      "</div>";

    document.body.appendChild(host);
    return host;
  }

  function init() {
    var host = mountUi();
    var handle = document.getElementById("lp-help-handle");
    var fab = document.getElementById("lp-help-fab");
    var panel = document.getElementById("lp-help-panel");
    var closeBtn = document.getElementById("lp-help-close");
    var messagesEl = document.getElementById("lp-help-messages");
    var inputEl = document.getElementById("lp-help-input");
    var sendBtn = document.getElementById("lp-help-send");
    var geminiFab = document.getElementById("lp-gemini-fab");
    var geminiPanel = document.getElementById("lp-gemini-panel");
    var geminiClose = document.getElementById("lp-gemini-close");
    var geminiOpen = document.getElementById("lp-gemini-open");
    var geminiCopy = document.getElementById("lp-gemini-copy");

    var knowledge = [];
    var knowledgeReady = false;
    var knowledgeErr = null;

    function appendMsg(role, htmlOrText, isHtml) {
      var wrap = document.createElement("div");
      wrap.className = "lp-help-msg lp-help-msg--" + (role === "user" ? "user" : "bot");
      if (role === "bot") {
        var av = document.createElement("div");
        av.className = "lp-help-avatar";
        av.setAttribute("aria-hidden", "true");
        var im = document.createElement("img");
        im.src = OSO_SRC; im.width = 24; im.height = 24; im.alt = "";
        av.appendChild(im);
        wrap.appendChild(av);
      }
      var bub = document.createElement("div");
      bub.className = "lp-help-bubble";
      if (isHtml) bub.innerHTML = htmlOrText;
      else bub.textContent = htmlOrText;
      wrap.appendChild(bub);
      messagesEl.appendChild(wrap);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    var lastUserQuestion = "";

    function welcomeIfEmpty() {
      if (messagesEl.childElementCount > 0) return;
      appendMsg("bot", "Hola. Soy el oso de ayuda. Dígame qué necesita y buscaré en la guía sin sacarle de esta pantalla.", false);
    }

    function setPanelOpen(open) {
      fab.setAttribute("aria-expanded", open ? "true" : "false");
      panel.classList.toggle("is-open", open);
      panel.hidden = !open;
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) {
        setGeminiOpen(false);
        welcomeIfEmpty();
        setTimeout(function () { inputEl.focus(); }, 100);
      }
    }

    function togglePeek() {
      host.classList.toggle("is-peek");
      if (host.classList.contains("is-peek")) {
        // autocierre si no se usa
        setTimeout(function () {
          if (!panel.classList.contains("is-open")) host.classList.remove("is-peek");
        }, 8000);
      }
    }

    handle.addEventListener("click", function () {
      togglePeek();
    });

    fab.addEventListener("click", function () {
      host.classList.add("is-peek");
      setPanelOpen(!panel.classList.contains("is-open"));
    });

    closeBtn.addEventListener("click", function () {
      setPanelOpen(false);
    });

    function setGeminiOpen(open) {
      geminiPanel.classList.toggle("is-open", open);
      geminiPanel.hidden = !open;
      geminiPanel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) host.classList.add("is-peek");
    }

    geminiFab.addEventListener("click", function () {
      // Cierra el panel de ayuda si está abierto, y abre/cierra Gemini.
      setPanelOpen(false);
      setGeminiOpen(!geminiPanel.classList.contains("is-open"));
    });
    geminiClose.addEventListener("click", function () {
      setGeminiOpen(false);
    });
    geminiOpen.addEventListener("click", function () {
      openGeminiPopup(lastUserQuestion || "");
    });
    geminiCopy.addEventListener("click", function () {
      var txt = String(lastUserQuestion || "").trim();
      if (!txt) {
        window.alert("Aún no hay una pregunta reciente para copiar.");
        return;
      }
      try {
        navigator.clipboard.writeText(txt).then(
          function () { window.alert("Pregunta copiada. Ahora puede pegarla en Gemini."); },
          function () { window.prompt("Copie este texto:", txt); }
        );
      } catch (e) {
        window.prompt("Copie este texto:", txt);
      }
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && panel.classList.contains("is-open")) {
        ev.preventDefault();
        setPanelOpen(false);
      }
      if (ev.key === "Escape" && geminiPanel.classList.contains("is-open")) {
        ev.preventDefault();
        setGeminiOpen(false);
      }
    });

    function fetchKnowledge() {
      return fetch(HELP_URL, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("No se pudo cargar ayuda.html (" + r.status + ")");
          return r.text();
        })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, "text/html");
          knowledge = buildKnowledgeFromDoc(doc);
          knowledgeReady = true;
        })
        .catch(function (err) {
          knowledgeErr = err;
          knowledgeReady = true;
        });
    }

    // Iniciar carga en segundo plano.
    fetchKnowledge();

    function send() {
      var text = String(inputEl.value || "").trim();
      if (!text) return;
      lastUserQuestion = text;
      appendMsg("user", text, false);
      inputEl.value = "";

      appendMsg("bot", '<p class="lp-help-meta">Un momento…</p>', true);
      var query = enrichQueryWithContext(text);
      setTimeout(function () {
        // eliminar "Un momento…"
        var last = messagesEl.lastElementChild;
        if (last && last.classList.contains("lp-help-msg--bot")) {
          // si es el meta, lo quitamos
          last.remove();
        }

        if (!knowledgeReady) {
          appendMsg("bot", "Estoy cargando la guía… intente de nuevo en un momento.", false);
          return;
        }
        if (knowledgeErr) {
          appendMsg("bot", "No pude cargar la guía de ayuda desde esta página. Verifique que exista «ayuda.html» en el mismo sitio.", false);
          return;
        }

        var results = findAnswers(knowledge, query);
        if (!results.matches.length) {
          appendMsg("bot", "No encontré una coincidencia clara. ¿En qué módulo está (Planillados, Mensualidades, Usuarios, Programación, Reportes)?", false);
          return;
        }
        setTopicFromResults(results);
        appendMsg("bot", formatAnswerHtml(results), true);
      }, 420);
    }

    sendBtn.addEventListener("click", send);
    inputEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

