/**
 * Escucha la colección Firestore «alertas» y alimenta las campanas del sitio.
 * Proyecto: check-list-9e21f · colección raíz /alertas
 */
(function (global) {
  var COLLECTION = "alertas";
  var FIRESTORE_SDK =
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js";
  var APP_SDK =
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
  var AUTH_SDK =
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";

  var TIPO_LABELS = {
    permiso: "Permiso",
    permiso_remunerado: "Permiso remunerado",
    permiso_no_remunerado: "Permiso no remunerado",
    cambio_turno: "Cambio de turno",
    cambio_de_turno: "Cambio de turno",
    incapacidad: "Incapacidad",
    vacaciones: "Vacaciones",
    licencia: "Licencia",
    descanso: "Descanso",
    inasistencia: "Inasistencia",
    salida_temprana: "Salida temprana",
    dominical: "Dominical",
    horas_extra: "Horas extra",
    reclamo: "Reclamo",
    novedad: "Novedad",
    solicitud: "Solicitud",
    sistema: "Sistema",
    sincronizacion: "Sincronización",
    recordatorio: "Recordatorio",
    incidencia: "Incidencia",
    error: "Error",
    mantenimiento: "Mantenimiento",
  };

  var TIPOS_SISTEMA = {
    sistema: 1,
    sincronizacion: 1,
    recordatorio: 1,
    incidencia: 1,
    error: 1,
    mantenimiento: 1,
  };

  var unsubscribe = null;
  var operatorsById = {};
  var lastParsedItems = [];

  function pickStr(v) {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    return "";
  }

  function nombreDesdeObjeto(obj) {
    if (!obj || typeof obj !== "object") return "";
    return pickStr(
      obj.name ||
        obj.nombre ||
        obj.operarioNombre ||
        obj.displayName ||
        obj.nombreCompleto ||
        obj.fullName ||
        obj.operadorNombre
    );
  }

  function extractOperarioNombre(data) {
    var campos = [
      data.operarioNombre,
      data.nombreOperario,
      data.operadorNombre,
      data.nombreOperador,
      data.nombreUsuario,
      data.usuarioNombre,
      data.userName,
      data.nombreCompleto,
      data.displayName,
      data.solicitante,
      data.creadoPor,
      data.remitente,
      data.nombreSolicitante,
      data.operador,
    ];
    var i;
    for (i = 0; i < campos.length; i++) {
      var s = pickStr(campos[i]);
      if (s) return s;
    }
    var op = data.operario;
    if (typeof op === "string") {
      s = op.trim();
      if (s && s.charAt(0) !== "{") return s;
    }
    s = nombreDesdeObjeto(op);
    if (s) return s;
    s = nombreDesdeObjeto(data.usuario || data.user || data.operator);
    if (s) return s;
    return pickStr(data.name);
  }

  function extractOperarioId(data) {
    var id = pickStr(
      data.operarioId ||
        data.operatorId ||
        data.operadorId ||
        data.idOperario ||
        data.uid ||
        data.userId ||
        data.idUsuario
    );
    if (id) return id;
    var op = data.operario;
    if (op && typeof op === "object") {
      id = pickStr(op.id || op.uid || op.operarioId);
      if (id) return id;
    }
    var user = data.usuario || data.user;
    if (user && typeof user === "object") {
      id = pickStr(user.uid || user.id);
      if (id) return id;
    }
    var ref = data.operarioRef || data.operatorRef || data.operadorRef;
    if (ref && ref.id) return String(ref.id);
    if (ref && ref.path) {
      var segs = String(ref.path).split("/");
      return segs[segs.length - 1] || "";
    }
    return "";
  }

  function enrichOperarioNombres(items) {
    (items || []).forEach(function (item) {
      if (item.operarioNombre) return;
      if (item.operarioId && operatorsById[item.operarioId]) {
        item.operarioNombre = operatorsById[item.operarioId];
      }
    });
    return items;
  }

  function loadOperatorsCache(db) {
    var colName =
      (typeof firebaseConfig !== "undefined" && firebaseConfig.operatorsCollection) ||
      "operators";
    return db
      .collection(colName)
      .get()
      .then(function (snap) {
        operatorsById = {};
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          operatorsById[doc.id] = pickStr(d.name || d.nombre) || doc.id;
        });
        if (lastParsedItems.length) {
          enrichOperarioNombres(lastParsedItems);
          pushToBells(lastParsedItems);
        }
      })
      .catch(function (err) {
        console.warn("[LuganoFirestoreAlertas] operators", err.message || err);
      });
  }

  function normTipo(tipo) {
    return String(tipo || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function labelTipo(tipo) {
    var key = normTipo(tipo);
    if (TIPO_LABELS[key]) return TIPO_LABELS[key];
    if (!tipo) return "Solicitud";
    return String(tipo)
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute("data-loaded") === "1") {
          resolve();
          return;
        }
        existing.addEventListener("load", function () {
          existing.setAttribute("data-loaded", "1");
          resolve();
        });
        existing.addEventListener("error", reject);
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () {
        s.setAttribute("data-loaded", "1");
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureFirebase() {
    return Promise.resolve()
      .then(function () {
        if (typeof firebaseConfig === "undefined") {
          return loadScript("firebase-config.js");
        }
      })
      .then(function () {
        if (typeof firebase === "undefined") {
          return loadScript(APP_SDK);
        }
      })
      .then(function () {
        try {
          if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(
              typeof firebaseConfig !== "undefined" ? firebaseConfig : {}
            );
          }
        } catch (e) {
          if (e.code !== "app/duplicate-app") throw e;
        }
        if (!firebase.firestore) {
          return loadScript(FIRESTORE_SDK);
        }
      })
      .then(function () {
        if (!firebase.auth) {
          return loadScript(AUTH_SDK);
        }
      });
  }

  function formatAlertaTime(ts) {
    if (!ts) return "";
    var d = null;
    if (ts && typeof ts.toDate === "function") d = ts.toDate();
    else if (ts && ts.seconds) d = new Date(ts.seconds * 1000);
    else if (ts instanceof Date) d = ts;
    else {
      var parsed = new Date(ts);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d) return "";
    return d.toLocaleString("es-CO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function dateKeyFromDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function mondayOfDateKey(dateKey) {
    var p = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!p) return null;
    var d = new Date(parseInt(p[1], 10), parseInt(p[2], 10) - 1, parseInt(p[3], 10));
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  var MESES_ES = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };

  /** Parsea «Médico: viernes 29 de mayo del 2026», «29 de mayo de 2026», 29/05/2026, etc. */
  function parseFechaDesdeTextoEspanol(text) {
    if (!text) return "";
    var s = String(text).trim();
    var iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    var dmy = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (dmy) {
      return (
        dmy[3] +
        "-" +
        pad2(parseInt(dmy[2], 10)) +
        "-" +
        pad2(parseInt(dmy[1], 10))
      );
    }
    var m = s.match(
      /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de(?:l)?\s+)?(\d{4})/i
    );
    if (m) {
      var dia = parseInt(m[1], 10);
      var mesKey = m[2].toLowerCase();
      if (mesKey === "setiembre") mesKey = "septiembre";
      var mes = MESES_ES[mesKey];
      var anio = parseInt(m[3], 10);
      if (mes != null && dia >= 1 && dia <= 31 && anio > 1990) {
        return dateKeyFromDate(new Date(anio, mes, dia));
      }
    }
    return "";
  }

  function parseFechaDesdeValor(raw) {
    if (raw == null || raw === "") return "";
    if (typeof raw === "string") {
      var iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (iso) return iso[1];
      var desdeTexto = parseFechaDesdeTextoEspanol(raw);
      if (desdeTexto) return desdeTexto;
    }
    if (raw && typeof raw.toDate === "function") {
      return dateKeyFromDate(raw.toDate());
    }
    if (raw && raw.seconds) {
      return dateKeyFromDate(new Date(raw.seconds * 1000));
    }
    return "";
  }

  function textosAlertaParaBuscarFecha(data) {
    data = data || {};
    var vistos = {};
    var lista = [];
    function push(val) {
      if (val == null || val === "") return;
      var s = String(val).trim();
      if (!s || vistos[s]) return;
      vistos[s] = true;
      lista.push(s);
    }
    [
      "fechaSolicitud",
      "fecha",
      "date",
      "fechaDia",
      "diaFecha",
      "fechaInicio",
      "fechaFin",
      "detalle",
      "mensaje",
      "descripcion",
      "texto",
      "observacion",
      "titulo",
      "asunto",
      "contenido",
      "info",
      "medico",
      "motivo",
      "resumen",
      "cuerpo",
      "nota",
      "tipoDescripcion",
    ].forEach(function (k) {
      push(data[k]);
    });
    Object.keys(data).forEach(function (k) {
      if (typeof data[k] === "string") push(data[k]);
    });
    return lista;
  }

  /**
   * Rangos típicos: «Vacaciones: del 1 de mayo de 2026 al 10 de mayo de 2026»,
   * «desde 2026-05-01 hasta 2026-05-10», «2026-05-01 - 2026-05-10».
   */
  function parseRangoDesdeTextoEspanol(text) {
    if (!text) return null;
    var s = String(text);
    var isoPair = s.match(
      /\b(\d{4}-\d{2}-\d{2})\b\s*[\-–\/]\s*\b(\d{4}-\d{2}-\d{2})\b/
    );
    if (isoPair) return { inicio: isoPair[1], fin: isoPair[2] };
    var i;
    for (i = 0; i < s.length - 5; i++) {
      var sub = s.slice(i);
      var m = sub.match(/\bdel\s+(.+?)\s+al\s+(.+)/i);
      if (!m) m = sub.match(/\bdesde\s+(.+?)\s+hasta\s+(.+)/i);
      if (!m) continue;
      var a = parseFechaDesdeTextoEspanol(m[1].trim());
      var b = parseFechaDesdeTextoEspanol(m[2].trim());
      if (a && b) return { inicio: a, fin: b };
      break;
    }
    return null;
  }

  /** Fechas inclusivas día a día entre dos ISO `YYYY-MM-DD` (max 62 días). */
  function expandirRangoFechasIso(inicioIso, finIso) {
    if (!inicioIso || !finIso) return [];
    var p0 = String(inicioIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    var p1 = String(finIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!p0 || !p1) return [];
    var d0 = new Date(+p0[1], +p0[2] - 1, +p0[3]);
    var d1 = new Date(+p1[1], +p1[2] - 1, +p1[3]);
    if (isNaN(d0.getTime()) || isNaN(d1.getTime())) return [];
    if (d1 < d0) {
      var t = d0;
      d0 = d1;
      d1 = t;
    }
    var out = [];
    var max = 62;
    var cur = new Date(d0.getTime());
    while (cur <= d1 && out.length < max) {
      out.push(dateKeyFromDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  /**
   * Campos tipo Firestore fechaInicio/fechaFin + texto «del … al …» en detalle.
   * Solo considera rangos válidos si ambos extremos pueden parsearse.
   */
  function extractRangoVacaciones(data) {
    data = data || {};
    var fi =
      parseFechaDesdeValor(data.fechaInicio) ||
      parseFechaDesdeValor(data.fechaDesde) ||
      parseFechaDesdeValor(data.desde);
    var ff =
      parseFechaDesdeValor(data.fechaFin) ||
      parseFechaDesdeValor(data.fechaHasta) ||
      parseFechaDesdeValor(data.hasta);
    if (fi && ff) return { inicio: fi, fin: ff };
    var textos = textosAlertaParaBuscarFecha(data);
    var idx;
    for (idx = 0; idx < textos.length; idx++) {
      var r = parseRangoDesdeTextoEspanol(textos[idx]);
      if (r && r.inicio && r.fin) return r;
    }
    return null;
  }

  /** Lista ordenada de días dentro del rango de vacaciones del documento, o []. */
  function extractFechasVacacionesLista(data) {
    var r = extractRangoVacaciones(data);
    if (!r) return [];
    var list = expandirRangoFechasIso(r.inicio, r.fin);
    return list;
  }

  function extractFechaSolicitud(data) {
    data = data || {};
    var textos = textosAlertaParaBuscarFecha(data);
    var i;
    for (i = 0; i < textos.length; i++) {
      var f = parseFechaDesdeValor(textos[i]);
      if (f) return f;
    }
    if (data.anio && data.mes && data.dia) {
      var mesNum = data.mes;
      if (typeof mesNum === "string" && MESES_ES[mesNum.toLowerCase()] != null) {
        mesNum = MESES_ES[mesNum.toLowerCase()] + 1;
      }
      return (
        String(data.anio) +
        "-" +
        pad2(parseInt(mesNum, 10)) +
        "-" +
        pad2(parseInt(data.dia, 10))
      );
    }
    return "";
  }

  function extractDiaIndexSolicitud(data, fechaKey) {
    data = data || {};
    if (data.diaIndex != null && data.diaIndex !== "" && !isNaN(data.diaIndex)) {
      var di = parseInt(data.diaIndex, 10);
      if (di >= 0 && di <= 6) return di;
    }
    if (data.dia != null && data.dia !== "" && !isNaN(data.dia)) {
      var dj = parseInt(data.dia, 10);
      if (dj >= 0 && dj <= 6) return dj;
    }
    if (fechaKey) {
      var mon = mondayOfDateKey(fechaKey);
      if (mon) {
        var p = fechaKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (p) {
          var d = new Date(
            parseInt(p[1], 10),
            parseInt(p[2], 10) - 1,
            parseInt(p[3], 10)
          );
          return Math.round((d.getTime() - mon.getTime()) / 86400000);
        }
      }
    }
    return null;
  }

  function isAlertaPendiente(data) {
    var e = normTipo(data.estado || data.status || "");
    if (
      e === "atendida" ||
      e === "cerrada" ||
      e === "rechazada" ||
      e === "aprobada" ||
      e === "resuelta" ||
      e === "leida" ||
      e === "cancelada"
    ) {
      return false;
    }
    if (data.leida === true || data.leido === true) return false;
    return true;
  }

  function normalizeAlertaDoc(id, data) {
    data = data || {};
    var tipo = data.tipo || data.tipoAlerta || data.tipoSolicitud || "";
    var operarioId = extractOperarioId(data);
    var operarioNombre = extractOperarioNombre(data);
    if (!operarioNombre && operarioId && operatorsById[operarioId]) {
      operarioNombre = operatorsById[operarioId];
    }
    var fecha = extractFechaSolicitud(data);
    var diaIndex = extractDiaIndexSolicitud(data, fecha);
    var weekKey = fecha && mondayOfDateKey(fecha) ? dateKeyFromDate(mondayOfDateKey(fecha)) : "";
    return {
      id: id,
      tipo: tipo,
      tipoLabel: labelTipo(tipo),
      operarioNombre: operarioNombre,
      operarioId: operarioId,
      fecha: fecha,
      diaIndex: diaIndex,
      weekKey: weekKey,
      detalle:
        data.detalle ||
        data.mensaje ||
        data.descripcion ||
        data.texto ||
        data.observacion ||
        "",
      sede:
        data.sede ||
        data.sedeNombre ||
        data.estacionamiento ||
        data.parking ||
        "",
      estado: data.estado || data.status || "",
      pendiente: isAlertaPendiente(data),
      time: formatAlertaTime(
        data.createdAt || data.fecha || data.timestamp || data.fechaCreacion
      ),
      raw: data,
    };
  }

  function textoPareceSolicitudOperario(item) {
    var txt = String(
      (item && item.detalle) ||
        (item && item.mensaje) ||
        (item && item.raw && item.raw.detalle) ||
        ""
    ).toLowerCase();
    return /m[eé]dico|permiso|incapacidad|vacacion|licencia|inasistencia|solicitud|salida\s*temprana|dominical|descanso/.test(
      txt
    );
  }

  function esAlertaOperario(item) {
    var t = normTipo(item.tipo);
    if (TIPOS_SISTEMA[t]) return false;
    if (item.operarioNombre || item.operarioId) return true;
    if (textoPareceSolicitudOperario(item)) return true;
    if (
      t.indexOf("permiso") >= 0 ||
      t.indexOf("turno") >= 0 ||
      t.indexOf("incapacidad") >= 0 ||
      t.indexOf("vacacion") >= 0 ||
      t.indexOf("licencia") >= 0 ||
      t.indexOf("inasistencia") >= 0 ||
      t.indexOf("salida") >= 0 ||
      t.indexOf("dominical") >= 0 ||
      t.indexOf("descanso") >= 0 ||
      t.indexOf("solicitud") >= 0 ||
      t.indexOf("novedad") >= 0 ||
      t.indexOf("reclamo") >= 0
    ) {
      return true;
    }
    var cat = normTipo(item.raw.categoria || item.raw.tipoRegistro || "");
    if (cat === "operario" || cat === "solicitud_operario") return true;
    return false;
  }

  function esAlertaSistema(item) {
    var t = normTipo(item.tipo);
    if (TIPOS_SISTEMA[t]) return true;
    var cat = normTipo(item.raw.categoria || "");
    if (cat === "sistema") return true;
    return !esAlertaOperario(item);
  }

  function toSystemUiItem(item) {
    if (esAlertaOperario(item)) {
      var opItem = toOperarioUiItem(item);
      opItem.esSolicitudOperario = true;
      opItem.text =
        [opItem.sede, opItem.detalle].filter(Boolean).join(" · ") || opItem.tipoLabel;
      return opItem;
    }
    var parts = [];
    if (item.sede) parts.push(item.sede);
    if (item.detalle) parts.push(item.detalle);
    return {
      id: item.id,
      tipo: item.tipo,
      tipoLabel: item.tipoLabel,
      operarioNombre: item.operarioNombre || "",
      text: parts.join(" · ") || item.tipoLabel,
      time: item.time,
      pendiente: item.pendiente,
    };
  }

  function toOperarioUiItem(item) {
    var nombre =
      item.operarioNombre ||
      (item.operarioId && operatorsById[item.operarioId]) ||
      "";
    return {
      alertId: item.id,
      id: item.id,
      operarioNombre: nombre || "Sin nombre de operario",
      operarioId: item.operarioId || "",
      tipo: item.tipo,
      tipoLabel: item.tipoLabel,
      tipoSolicitud: item.tipoLabel,
      detalle: item.detalle,
      mensaje: item.detalle,
      sede: item.sede,
      fecha: item.fecha || "",
      diaIndex: item.diaIndex,
      weekKey: item.weekKey || "",
      time: item.time,
      estado: item.estado || "",
      pendiente: item.pendiente,
      raw: item.raw,
    };
  }

  function buildSolicitudAccionesHtml(item) {
    var est = normTipo(item.estado || "");
    if (est === "aprobada" || est === "rechazada") {
      return (
        '<p class="prog-sol-estado prog-sol-estado--' +
        est +
        '">' +
        (est === "aprobada" ? "Aprobada" : "Rechazada") +
        "</p>"
      );
    }
    var revAct = est === "en_revision" ? " prog-sol-btn--active" : "";
    return (
      '<div class="prog-solicitud-actions">' +
      '<button type="button" class="prog-sol-btn prog-sol-btn--ok" data-prog-sol-action="aprobar">✓ Aprobar</button>' +
      '<button type="button" class="prog-sol-btn prog-sol-btn--no" data-prog-sol-action="rechazar">✕ Rechazar</button>' +
      '<button type="button" class="prog-sol-btn prog-sol-btn--rev' +
      revAct +
      '" data-prog-sol-action="revision">⏳ En revisión</button>' +
      "</div>"
    );
  }

  function buildSolicitudListItemHtml(item, escapeHtml) {
    escapeHtml =
      escapeHtml ||
      function (s) {
        return String(s || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };
    var op =
      item.operarioNombre ||
      (item.operarioId ? "Operario (" + item.operarioId + ")" : "Sin nombre");
    var tipo = item.tipoSolicitud || item.tipoLabel || labelTipo(item.tipo) || "Solicitud";
    var det = item.detalle || item.mensaje || "";
    var sede = item.sede || "";
    var fechaTxt = item.fechaLabel || item.fecha || "Fecha no indicada";
    var acciones = buildSolicitudAccionesHtml(item);
    return (
      '<li class="lugano-alerts-item prog-solicitud-item" data-alert-id="' +
      escapeHtml(item.alertId || item.id || "") +
      '">' +
      "<strong>" +
      escapeHtml(op) +
      "</strong>" +
      '<span class="lugano-alerts-tipo lugano-alerts-tipo--operario">' +
      escapeHtml(tipo) +
      "</span>" +
      '<span class="prog-solicitud-meta">📅 ' +
      escapeHtml(fechaTxt) +
      "</span>" +
      (sede ? '<span class="prog-solicitud-meta">🏢 ' + escapeHtml(sede) + "</span>" : "") +
      (det ? '<span class="prog-solicitud-meta">' + escapeHtml(det) + "</span>" : "") +
      (item.time ? "<time>" + escapeHtml(item.time) + "</time>" : "") +
      acciones +
      "</li>"
    );
  }

  function updateAlertaEstado(alertId, patch) {
    if (!alertId) return Promise.reject(new Error("Falta id de alerta"));
    return ensureFirebase().then(function () {
      var db = firebase.firestore();
      var auth = firebase.auth && firebase.auth();
      var data = Object.assign({}, patch || {});
      if (!data.resueltaAt && (data.estado === "aprobada" || data.estado === "rechazada")) {
        data.resueltaAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      if (auth && auth.currentUser && auth.currentUser.email) {
        if (data.estado === "aprobada" && !data.aprobadaPor) {
          data.aprobadaPor = auth.currentUser.email;
        }
        if (data.estado === "rechazada" && !data.rechazadaPor) {
          data.rechazadaPor = auth.currentUser.email;
        }
      }
      return db.collection(COLLECTION).doc(alertId).update(data);
    });
  }

  function sortByTimeDesc(a, b) {
    var ta = a.time || "";
    var tb = b.time || "";
    return tb.localeCompare(ta, "es");
  }

  function pushToBells(allItems) {
    var pendientes = allItems.filter(function (x) {
      return x.pendiente;
    });
    var sistema = pendientes.map(toSystemUiItem);
    var operario = pendientes.filter(esAlertaOperario).map(toOperarioUiItem);
    sistema.sort(sortByTimeDesc);
    operario.sort(sortByTimeDesc);

    if (global.LuganoAlerts && typeof global.LuganoAlerts.setSystemAlerts === "function") {
      global.LuganoAlerts.setSystemAlerts(sistema);
    }
    if (
      global.ProgOperarioAlerts &&
      typeof global.ProgOperarioAlerts.setSolicitudes === "function"
    ) {
      global.ProgOperarioAlerts.setSolicitudes(operario);
    }
    global.__luganoSolicitudesById = {};
    operario.forEach(function (o) {
      if (o.alertId) global.__luganoSolicitudesById[o.alertId] = o;
    });
    sistema.forEach(function (s) {
      if (s.alertId) global.__luganoSolicitudesById[s.alertId] = s;
    });
  }

  function parseSnapshot(snap) {
    var items = [];
    snap.forEach(function (doc) {
      items.push(normalizeAlertaDoc(doc.id, doc.data()));
    });
    items.sort(function (a, b) {
      var ta =
        (a.raw.createdAt && a.raw.createdAt.seconds) ||
        (a.raw.fecha && a.raw.fecha.seconds) ||
        0;
      var tb =
        (b.raw.createdAt && b.raw.createdAt.seconds) ||
        (b.raw.fecha && b.raw.fecha.seconds) ||
        0;
      return tb - ta;
    });
    return items;
  }

  function subscribeAlertas(db) {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    var col = db.collection(COLLECTION);
    var usedFallback = false;

    function attach(query, isFallback) {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      unsubscribe = query.onSnapshot(
        function (snap) {
          lastParsedItems = parseSnapshot(snap);
          enrichOperarioNombres(lastParsedItems);
          pushToBells(lastParsedItems);
        },
        function (err) {
          console.warn("[LuganoFirestoreAlertas]", err.message || err);
          if (!isFallback && !usedFallback) {
            usedFallback = true;
            attach(col.limit(80), true);
          }
        }
      );
    }

    attach(col.orderBy("createdAt", "desc").limit(80), false);
  }

  function waitForBellApi(cb, n) {
    n = n || 0;
    if (global.LuganoAlerts) {
      cb();
      return;
    }
    if (n > 80) return;
    setTimeout(function () {
      waitForBellApi(cb, n + 1);
    }, 50);
  }

  function start() {
    waitForBellApi(function () {
      ensureFirebase()
        .then(function () {
          var db = firebase.firestore();
          var auth = firebase.auth && firebase.auth();
          if (!auth) {
            subscribeAlertas(db);
            return;
          }
          auth.onAuthStateChanged(function (user) {
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
            if (!user) {
              lastParsedItems = [];
              pushToBells([]);
              return;
            }
            loadOperatorsCache(db);
            subscribeAlertas(db);
          });
        })
        .catch(function (err) {
          console.warn("[LuganoFirestoreAlertas] init", err);
        });
    });
  }

  global.LuganoFirestoreAlertas = {
    labelTipo: labelTipo,
    parseFechaDesdeTextoEspanol: parseFechaDesdeTextoEspanol,
    parseRangoDesdeTextoEspanol: parseRangoDesdeTextoEspanol,
    extractRangoVacaciones: extractRangoVacaciones,
    extractFechasVacacionesLista: extractFechasVacacionesLista,
    expandirRangoFechasIso: expandirRangoFechasIso,
    buildSolicitudListItemHtml: buildSolicitudListItemHtml,
    extractFechaSolicitud: extractFechaSolicitud,
    extractDiaIndexSolicitud: extractDiaIndexSolicitud,
    updateAlertaEstado: updateAlertaEstado,
    refresh: function () {
      if (typeof firebase !== "undefined" && firebase.firestore) {
        subscribeAlertas(firebase.firestore());
      }
    },
    stop: function () {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      pushToBells([]);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : this);
