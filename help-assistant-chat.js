/**
 * Asistente de ayuda: chat local que responde a partir del texto de ayuda.html
 * (secciones .help-section, texto introductorio, nota final y bloque «entradas propias» generado en el DOM). Sin servidor.
 */
(function () {
  var STOP = {
    el: 1,
    la: 1,
    los: 1,
    las: 1,
    un: 1,
    una: 1,
    uno: 1,
    unos: 1,
    unas: 1,
    y: 1,
    o: 1,
    u: 1,
    de: 1,
    del: 1,
    al: 1,
    a: 1,
    en: 1,
    con: 1,
    por: 1,
    para: 1,
    que: 1,
    como: 1,
    es: 1,
    son: 1,
    se: 1,
    su: 1,
    sus: 1,
    lo: 1,
    le: 1,
    les: 1,
    no: 1,
    ni: 1,
    ya: 1,
    muy: 1,
    tan: 1,
    mas: 1,
    menos: 1,
    este: 1,
    esta: 1,
    estos: 1,
    estas: 1,
    ese: 1,
    esa: 1,
    aquel: 1,
    hay: 1,
    cada: 1,
    otro: 1,
    otra: 1,
    ser: 1,
    estar: 1,
    debe: 1,
    pueden: 1,
    puede: 1,
    sobre: 1,
    entre: 1,
    desde: 1,
    hasta: 1,
    sin: 1,
    ante: 1,
    bajo: 1,
    todo: 1,
    todas: 1,
    todos: 1,
    tambien: 1,
    tampoco: 1,
    solo: 1,
    si: 1,
    asi: 1,
    quien: 1,
    cuando: 1,
    donde: 1,
    cual: 1,
    fue: 1,
    sera: 1,
    ha: 1,
    han: 1,
    he: 1,
    hemos: 1,
    vos: 1,
    uso: 1,
    usan: 1,
    ver: 1,
    vere: 1,
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

  function buildKnowledge(mainApp) {
    var items = [];
    if (!mainApp) return items;

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
      var sectionTitle = h2
        ? h2.textContent.replace(/\s+/g, " ").trim()
        : "";
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

    var fullNorm = stripAccents(item.question + " " + item.answer).replace(/\s+/g, " ");
    var joined = tokensExpanded.join(" ");
    if (joined.length >= 8 && fullNorm.indexOf(joined.slice(0, Math.min(joined.length, 40))) !== -1) {
      score += 4;
    }

    return score;
  }

  function findAnswers(knowledge, userText) {
    var tokens = tokenize(userText);
    if (!tokens.length) return { matches: [], best: 0 };

    var expanded = expandSynonyms(tokens);
    var ranked = knowledge.map(function (item) {
      return {
        item: item,
        score: scoreMessage(expanded, item),
      };
    });

    ranked.sort(function (x, y) {
      return y.score - x.score;
    });

    var best = ranked[0] ? ranked[0].score : 0;
    var matches = [];
    if (best < 2) return { matches: [], best: 0 };

    matches.push(ranked[0]);
    for (var i = 1; i < ranked.length && matches.length < 3; i++) {
      if (ranked[i].score < Math.max(3, best * 0.45)) break;
      if (ranked[i].score > 0) matches.push(ranked[i]);
    }
    return { matches: matches, best: best };
  }

  function formatAnswerHtml(results) {
    if (!results.matches.length) {
      return "";
    }

    var parts = [];
    results.matches.forEach(function (entry, idx) {
      var it = entry.item;
      var sec = escapeHtml(it.section || "");
      var q = escapeHtml(it.question || "");
      var a = escapeHtml(it.answer || "");
      var anchor = it.anchor
        ? '<p class="help-bot-msg-anchor"><a href="#' + escapeHtml(it.anchor) + '">Abrir esta parte en la guía</a></p>'
        : "";

      parts.push(
        '<div class="help-bot-hit">' +
          (idx ? '<hr class="help-bot-hit-divider"/>' : "") +
          '<p class="help-bot-hit-meta">' +
          sec +
          "</p>" +
          '<p class="help-bot-hit-q">' +
          q +
          "</p>" +
          '<p class="help-bot-hit-a">' +
          a +
          "</p>" +
          anchor +
          "</div>"
      );
    });

    parts.unshift(
      '<p class="help-bot-lead-in">Esto es lo más cercano a su consulta, según el texto disponible en la guía:</p>'
    );
    parts.push(
      '<p class="help-bot-follow">¿Le responde bien? Si no del todo, reescriba la pregunta con otras palabras o elija una sugerencia más abajo.</p>'
    );
    return parts.join("");
  }

  /* --- UI --- */

  var mainApp = document.getElementById("main-app");
  var fab = document.getElementById("help-bot-fab");
  var panel = document.getElementById("help-bot-panel");
  var closeBtn = document.getElementById("help-bot-close");
  var messagesEl = document.getElementById("help-bot-messages");
  var inputEl = document.getElementById("help-bot-input");
  var sendBtn = document.getElementById("help-bot-send");

  if (!fab || !panel || !closeBtn || !messagesEl || !inputEl || !sendBtn || !mainApp) {
    return;
  }

  function rebuildKnowledge() {
    return buildKnowledge(mainApp);
  }

  var knowledge = rebuildKnowledge();

  document.addEventListener("lugano-help-custom-changed", function () {
    knowledge = rebuildKnowledge();
  });

  var OSO_SRC = "logolugano1.jpg";
  var WELCOME_LINES = [
    "¡Hola! Soy el oso de ayuda. Dígame qué está intentando hacer y lo guiamos juntos. Si me falta un dato, le haré una pregunta corta para afinar.",
    "¡Bienvenido! Cuénteme el caso con sus palabras (qué módulo, qué vio en pantalla y qué quería lograr) y yo le iré proponiendo el siguiente paso.",
    "Hola, estoy listo para ayudar. Si su consulta es amplia, iremos por partes: primero ubicamos el módulo y luego el paso exacto.",
  ];

  var convo = {
    lastClarify: null,
    turn: 0,
    lastTopic: "",
    lastUserText: "",
  };

  function isShortFollowup(text) {
    var t = stripAccents(text).trim();
    if (!t) return false;
    // Respuestas típicas de seguimiento o corrección.
    if (
      t === "si" ||
      t === "sí" ||
      t === "no" ||
      t === "ok" ||
      t === "vale" ||
      t === "listo" ||
      t === "eso" ||
      t === "esa" ||
      t === "ese" ||
      t === "esta" ||
      t === "este"
    )
      return true;
    // Si es muy corto y no trae palabras clave, tratarlo como seguimiento.
    var toks = tokenize(text);
    return toks.length > 0 && toks.length <= 2;
  }

  function enrichQueryWithContext(userText) {
    if (!convo.lastTopic) return userText;
    if (!isShortFollowup(userText)) return userText;
    // Inyectar el tema previo para mejorar la recuperación.
    return userText + " " + convo.lastTopic;
  }

  function uniqNonEmpty(arr) {
    var out = [];
    var seen = {};
    (arr || []).forEach(function (s) {
      s = String(s || "").trim();
      if (!s) return;
      if (seen[s]) return;
      seen[s] = 1;
      out.push(s);
    });
    return out;
  }

  function deriveClarifyOptions(results) {
    if (!results || !results.matches || !results.matches.length) return [];
    var opts = [];
    results.matches.forEach(function (entry) {
      var it = entry.item || {};
      if (it.section) opts.push(it.section);
      if (it.question) opts.push(it.question);
    });
    // Priorizar secciones primero y luego preguntas, limitando el tamaño visual.
    opts = uniqNonEmpty(opts).slice(0, 4);
    return opts;
  }

  function setTopicFromResults(results) {
    if (!results || !results.matches || !results.matches.length) return;
    var it = results.matches[0].item;
    if (it && it.section) convo.lastTopic = String(it.section || "").trim();
  }

  function askClarify(questionText, options) {
    convo.lastClarify = {
      q: questionText,
      options: options.slice(),
      at: Date.now(),
    };
    appendBubble(
      "bot",
      "<p>" +
        escapeHtml(questionText) +
        "</p>",
      true
    );
    appendSuggestionChips(options, "Elija una opción para continuar:");
  }

  function removeStaleChips() {
    messagesEl.querySelectorAll(".help-bot-chips-strip").forEach(function (n) {
      n.remove();
    });
  }

  function appendSuggestionChips(labels, hintText) {
    removeStaleChips();
    var strip = document.createElement("div");
    strip.className = "help-bot-chips-strip";
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", "Temas sugeridos");
    if (hintText) {
      var hi = document.createElement("p");
      hi.className = "help-bot-chip-hint";
      hi.textContent = hintText;
      strip.appendChild(hi);
    }
    labels.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "help-bot-chip";
      btn.textContent = label;
      btn.addEventListener("click", function () {
        inputEl.value = label;
        sendQuestion();
      });
      strip.appendChild(btn);
    });
    messagesEl.appendChild(strip);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendBubble(role, htmlOrText, isHtml) {
    var wrap = document.createElement("div");
    wrap.className =
      "help-bot-msg help-bot-msg--" + (role === "user" ? "user" : "bot");
    if (role === "bot") {
      var av = document.createElement("div");
      av.className = "help-bot-avatar";
      av.setAttribute("aria-hidden", "true");
      var im = document.createElement("img");
      im.src = OSO_SRC;
      im.width = 24;
      im.height = 24;
      im.alt = "";
      av.appendChild(im);
      wrap.appendChild(av);
    }
    var inner = document.createElement("div");
    inner.className = "help-bot-msg-inner";
    if (isHtml) inner.innerHTML = htmlOrText;
    else inner.textContent = htmlOrText;
    wrap.appendChild(inner);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendThinking() {
    var id = "help-bot-thinking";
    var el = document.getElementById(id);
    if (el) el.remove();
    var wrap = document.createElement("div");
    wrap.id = id;
    wrap.className = "help-bot-msg help-bot-msg--bot help-bot-thinking";
    var av = document.createElement("div");
    av.className = "help-bot-avatar";
    av.setAttribute("aria-hidden", "true");
    var im = document.createElement("img");
    im.src = OSO_SRC;
    im.width = 24;
    im.height = 24;
    im.alt = "";
    av.appendChild(im);
    wrap.appendChild(av);
    var inner = document.createElement("div");
    inner.className = "help-bot-msg-inner";
    inner.innerHTML =
      '<p class="help-bot-thinking-meta">Un momento… estoy buscando en la guía.</p>' +
      '<span class="help-bot-dots"><span>.</span><span>.</span><span>.</span></span>';
    wrap.appendChild(inner);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function removeThinking() {
    var el = document.getElementById("help-bot-thinking");
    if (el) el.remove();
  }

  function injectWelcomeIfEmpty() {
    if (messagesEl.childElementCount > 0) return;
    var line = WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)];
    appendBubble("bot", line, false);
  }

  function setOpen(open) {
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    panel.classList.toggle("is-open", open);
    if (open) {
      panel.removeAttribute("hidden");
      injectWelcomeIfEmpty();
      window.setTimeout(function () {
        inputEl.focus();
      }, 120);
    } else {
      panel.setAttribute("hidden", "");
      fab.focus();
    }
  }

  function sendQuestion() {
    var text = String(inputEl.value || "").trim();
    if (!text) return;

    removeStaleChips();
    appendBubble("user", text, false);
    inputEl.value = "";

    appendThinking();

    var delay = 420 + Math.floor(Math.random() * 360);
    window.setTimeout(function () {
      removeThinking();
      convo.turn++;
      var query = enrichQueryWithContext(text);
      convo.lastUserText = text;
      var results = findAnswers(knowledge, query);

      // Caso 1: no hay coincidencias -> indagación guiada (pregunta + opciones)
      if (!results.matches.length) {
        appendBubble(
          "bot",
          "<p>No pude ubicar una respuesta exacta con esas palabras.</p>" +
            "<p>Vamos paso a paso: ¿en qué parte del portal está trabajando (por ejemplo: Reportes, Planillados, Mensualidades, Usuarios o Programación)?</p>",
          true
        );
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return;
      }

      setTopicFromResults(results);

      // Caso 2: hay coincidencias, pero puede ser ambiguo (varias similares)
      var best = results.best || 0;
      var secondScore =
        results.matches.length > 1 ? results.matches[1].score : 0;
      var ambiguous =
        results.matches.length > 1 && secondScore >= Math.max(3, best * 0.8);

      if (ambiguous && convo.turn <= 2) {
        var opts = deriveClarifyOptions(results);
        // Si no se derivan opciones útiles, caer a sugerencias base.
        if (opts.length >= 2) {
          askClarify(
            "Veo dos posibilidades. ¿A cuál se refiere más?",
            opts
          );
          messagesEl.scrollTop = messagesEl.scrollHeight;
          return;
        }
      }

      // Caso 3: respuesta normal
      appendBubble("bot", formatAnswerHtml(results), true);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, delay);
  }

  fab.addEventListener("click", function () {
    var wasOpen = fab.getAttribute("aria-expanded") === "true";
    setOpen(!wasOpen);
  });

  closeBtn.addEventListener("click", function () {
    setOpen(false);
  });

  sendBtn.addEventListener("click", sendQuestion);

  inputEl.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      sendQuestion();
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && fab.getAttribute("aria-expanded") === "true") {
      ev.preventDefault();
      setOpen(false);
    }
  });
})();
