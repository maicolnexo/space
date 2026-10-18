/**
 * Sustituye firebase.firestore() por la tabla public.documents de Supabase.
 * Auth y Storage siguen en Firebase. Las páginas conservan la API de Firestore
 * (collection, doc, get, set, update, delete, batch, onSnapshot, collectionGroup).
 */
(function (global) {
  var TABLE = "documents";
  var POLL_MS = 3000;
  var cache = new Map();
  var cacheReady = false;
  var epoch = 0;
  var inflight = null;
  var listeners = [];
  var pollTimer = null;
  var dbSingleton = null;
  var fetchPatched = false;

  function cfg() {
    if (typeof firebaseConfig !== "undefined" && firebaseConfig) return firebaseConfig;
    return global.firebaseConfig || {};
  }

  function enabled() {
    var c = cfg();
    return !!(c.supabaseUrl && c.supabaseAnonKey);
  }

  function baseUrl() {
    return String(cfg().supabaseUrl || "").replace(/\/+$/, "");
  }

  function fsError(code, message) {
    var err = new Error(message || code);
    err.code = code;
    return err;
  }

  function Sentinel(kind) {
    this.kind = kind;
  }

  function isServerTs(v) {
    return v instanceof Sentinel && v.kind === "serverTimestamp";
  }

  function isDelete(v) {
    return v instanceof Sentinel && v.kind === "deleteField";
  }

  function Timestamp(seconds, nanoseconds) {
    this.seconds = seconds | 0;
    this.nanoseconds = nanoseconds | 0;
  }

  Timestamp.prototype.toDate = function () {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
  };

  Timestamp.prototype.toMillis = function () {
    return this.toDate().getTime();
  };

  Timestamp.now = function () {
    return Timestamp.fromDate(new Date());
  };

  Timestamp.fromDate = function (date) {
    var ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (isNaN(ms)) ms = Date.now();
    var seconds = Math.floor(ms / 1000);
    var nanoseconds = (ms - seconds * 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  };

  Timestamp.fromMillis = function (ms) {
    return Timestamp.fromDate(new Date(ms));
  };

  function timestampPlain(date) {
    var ts = Timestamp.fromDate(date || new Date());
    return { seconds: ts.seconds, nanoseconds: ts.nanoseconds };
  }

  function isTimestampShape(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    var keys = Object.keys(v);
    if (!keys.length) return false;
    var ok = true;
    keys.forEach(function (k) {
      if (k !== "seconds" && k !== "nanoseconds" && k !== "_seconds" && k !== "_nanoseconds") {
        ok = false;
      }
    });
    if (!ok) return false;
    return typeof (v.seconds != null ? v.seconds : v._seconds) === "number";
  }

  function revive(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(revive);
    if (isTimestampShape(value)) {
      return new Timestamp(
        value.seconds != null ? value.seconds : value._seconds,
        value.nanoseconds != null ? value.nanoseconds : value._nanoseconds || 0
      );
    }
    var out = {};
    Object.keys(value).forEach(function (k) {
      out[k] = revive(value[k]);
    });
    return out;
  }

  function serializeValue(value) {
    if (isDelete(value)) return value;
    if (isServerTs(value)) return timestampPlain(new Date());
    if (value instanceof Timestamp) {
      return { seconds: value.seconds, nanoseconds: value.nanoseconds || 0 };
    }
    if (value instanceof Date) return timestampPlain(value);
    if (Array.isArray(value)) return value.map(serializeValue);
    if (value && typeof value === "object") {
      if (typeof value.toDate === "function" && typeof value.seconds === "number") {
        return { seconds: value.seconds, nanoseconds: value.nanoseconds || 0 };
      }
      var out = {};
      Object.keys(value).forEach(function (k) {
        var next = serializeValue(value[k]);
        if (!isDelete(next)) out[k] = next;
      });
      return out;
    }
    return value;
  }

  function isPlainMap(v) {
    return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !isTimestampShape(v) && !(v instanceof Timestamp) && !isServerTs(v) && !isDelete(v);
  }

  function mergeMaps(base, patch) {
    var out = {};
    if (isPlainMap(base)) {
      Object.keys(base).forEach(function (k) {
        out[k] = base[k];
      });
    }
    Object.keys(patch || {}).forEach(function (k) {
      var v = patch[k];
      if (isDelete(v)) {
        delete out[k];
        return;
      }
      if (isServerTs(v)) {
        out[k] = timestampPlain(new Date());
        return;
      }
      if (isPlainMap(v) && isPlainMap(out[k])) {
        out[k] = mergeMaps(out[k], v);
        return;
      }
      out[k] = serializeValue(v);
    });
    return out;
  }

  function applyUpdate(base, patch) {
    var out = {};
    if (base && typeof base === "object") {
      Object.keys(base).forEach(function (k) {
        out[k] = base[k];
      });
    }
    Object.keys(patch || {}).forEach(function (k) {
      if (isDelete(patch[k])) delete out[k];
      else out[k] = serializeValue(patch[k]);
    });
    return out;
  }

  function eqFilter(column, value) {
    var raw = String(value);
    if (/[,()"]/.test(raw)) {
      raw = '"' + raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }
    return column + "=eq." + encodeURIComponent(raw);
  }

  function request(method, pathAndQuery, body, extraHeaders) {
    var headers = {
      apikey: cfg().supabaseAnonKey,
      Authorization: "Bearer " + cfg().supabaseAnonKey,
      Accept: "application/json"
    };
    if (body != null) headers["Content-Type"] = "application/json";
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function (k) {
        headers[k] = extraHeaders[k];
      });
    }
    return fetch(baseUrl() + pathAndQuery, {
      method: method,
      headers: headers,
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: "omit"
    }).then(function (res) {
      if (res.status === 204 || res.status === 205) {
        return { status: res.status, body: null };
      }
      return res.text().then(function (text) {
        var parsed = null;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }
        }
        if (!res.ok) {
          var msg =
            (parsed && parsed.message) ||
            (parsed && parsed.error) ||
            (parsed && parsed.hint) ||
            text ||
            res.statusText;
          var code = "unknown";
          if (res.status === 401 || res.status === 403) code = "permission-denied";
          else if (res.status === 404) code = "not-found";
          var err = fsError(code, msg || "Error de Supabase (" + res.status + ")");
          err.status = res.status;
          throw err;
        }
        return { status: res.status, body: parsed };
      });
    });
  }

  function normalizeRow(row) {
    if (!row || !row.path) return null;
    var data = row.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = {};
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    return {
      path: String(row.path),
      collection_path: String(row.collection_path || parentPath(row.path)),
      doc_id: String(row.doc_id || lastSegment(row.path)),
      data: data,
      updated_at: row.updated_at || null
    };
  }

  function lastSegment(path) {
    var parts = String(path || "").split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function parentPath(path) {
    var parts = String(path || "").split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  function fetchAllRows() {
    var pageSize = 1000;
    var all = [];
    function page(from) {
      return request(
        "GET",
        "/rest/v1/" + TABLE + "?select=path,collection_path,doc_id,data,updated_at&limit=" + pageSize,
        null,
        { Range: from + "-" + (from + pageSize - 1) }
      ).then(function (res) {
        var chunk = Array.isArray(res.body) ? res.body : [];
        all = all.concat(chunk);
        if (chunk.length < pageSize) return all;
        return page(from + pageSize);
      });
    }
    return page(0);
  }

  function loadAll() {
    if (!enabled()) return Promise.reject(fsError("failed-precondition", "Falta supabaseUrl o supabaseAnonKey"));
    if (inflight) return inflight;
    var seen = epoch;
    inflight = fetchAllRows()
      .then(function (rows) {
        if (seen !== epoch) return cache;
        var next = new Map();
        rows.forEach(function (raw) {
          var row = normalizeRow(raw);
          if (row) next.set(row.path, row);
        });
        cache = next;
        cacheReady = true;
        return cache;
      })
      .finally(function () {
        inflight = null;
      });
    return inflight;
  }

  function noteWrite(path, rowOrNull) {
    epoch += 1;
    if (rowOrNull) cache.set(path, rowOrNull);
    else cache.delete(path);
    cacheReady = true;
    notify();
  }

  function getField(data, field) {
    var parts = String(field || "").split(".");
    var cur = data;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function cmpScalar(a, b) {
    var av = normCmp(a);
    var bv = normCmp(b);
    if (av === bv) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    var as = String(av);
    var bs = String(bv);
    if (as < bs) return -1;
    if (as > bs) return 1;
    return 0;
  }

  function normCmp(v) {
    if (v instanceof Timestamp) return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (isTimestampShape(v)) return (v.seconds != null ? v.seconds : v._seconds) * 1000;
    return v;
  }

  function matchFilter(data, filter) {
    var left = getField(data, filter.field);
    var right = filter.value;
    var op = filter.op;
    if (op === "==") return cmpScalar(left, right) === 0;
    if (op === "!=") return cmpScalar(left, right) !== 0;
    if (op === "<") return left != null && cmpScalar(left, right) < 0;
    if (op === "<=") return left != null && cmpScalar(left, right) <= 0;
    if (op === ">") return left != null && cmpScalar(left, right) > 0;
    if (op === ">=") return left != null && cmpScalar(left, right) >= 0;
    if (op === "array-contains") return Array.isArray(left) && left.some(function (item) { return cmpScalar(item, right) === 0; });
    if (op === "in") return Array.isArray(right) && right.some(function (item) { return cmpScalar(left, item) === 0; });
    if (op === "array-contains-any") {
      if (!Array.isArray(left) || !Array.isArray(right)) return false;
      return right.some(function (item) {
        return left.some(function (have) { return cmpScalar(have, item) === 0; });
      });
    }
    return false;
  }

  function rowMatches(row, spec) {
    if (!row) return false;
    if (spec.kind === "doc") return row.path === spec.path;
    if (spec.kind === "collection") return row.collection_path === spec.collectionPath;
    if (spec.kind === "group") return lastSegment(row.collection_path) === spec.groupId;
    return false;
  }

  function selectRows(spec) {
    var rows = [];
    cache.forEach(function (row) {
      if (!rowMatches(row, spec)) return;
      var revived = revive(row.data);
      var ok = true;
      (spec.filters || []).forEach(function (f) {
        if (!matchFilter(revived, f)) ok = false;
      });
      if (ok) rows.push(row);
    });
    if (spec.orders && spec.orders.length) {
      var ordered = [];
      rows.forEach(function (row) {
        var revived = revive(row.data);
        var missing = false;
        spec.orders.forEach(function (ord) {
          if (getField(revived, ord.field) == null) missing = true;
        });
        if (!missing) ordered.push(row);
      });
      ordered.sort(function (a, b) {
        var ad = revive(a.data);
        var bd = revive(b.data);
        for (var i = 0; i < spec.orders.length; i++) {
          var ord = spec.orders[i];
          var c = cmpScalar(getField(ad, ord.field), getField(bd, ord.field));
          if (c !== 0) return ord.dir === "desc" ? -c : c;
        }
        return 0;
      });
      rows = ordered;
    } else {
      rows.sort(function (a, b) {
        if (a.doc_id < b.doc_id) return -1;
        if (a.doc_id > b.doc_id) return 1;
        return 0;
      });
    }
    if (spec.limitN != null) rows = rows.slice(0, spec.limitN);
    return rows;
  }

  function DocRef(path) {
    var parts = String(path || "").split("/").filter(Boolean);
    this.path = parts.join("/");
    this.id = parts.length ? parts[parts.length - 1] : "";
    this.parent = parts.length > 1 ? new CollectionRef(parts.slice(0, -1).join("/")) : new CollectionRef(parts[0] || "");
    if (parts.length <= 1) this.parent = new CollectionRef("");
  }

  function docSnap(path, row) {
    var ref = new DocRef(path);
    var exists = !!(row && row.path);
    return {
      id: ref.id,
      ref: ref,
      exists: exists,
      data: function () {
        return exists ? revive(row.data) : undefined;
      }
    };
  }

  function querySnap(rows, changes) {
    var docs = rows.map(function (row) {
      return docSnap(row.path, row);
    });
    return {
      docs: docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: function (fn) {
        docs.forEach(function (doc) {
          fn(doc);
        });
      },
      docChanges: function () {
        return changes || [];
      }
    };
  }

  function diffChanges(prevJson, rows) {
    var nextJson = {};
    var nextIndex = {};
    rows.forEach(function (row, i) {
      nextJson[row.path] = JSON.stringify(row.data);
      nextIndex[row.path] = i;
    });
    if (!prevJson) {
      return rows.map(function (row, i) {
        return { type: "added", doc: docSnap(row.path, row), oldIndex: -1, newIndex: i };
      });
    }
    var changes = [];
    Object.keys(prevJson).forEach(function (path) {
      if (!Object.prototype.hasOwnProperty.call(nextJson, path)) {
        changes.push({
          type: "removed",
          doc: docSnap(path, null),
          oldIndex: -1,
          newIndex: -1
        });
      }
    });
    rows.forEach(function (row, i) {
      if (!Object.prototype.hasOwnProperty.call(prevJson, row.path)) {
        changes.push({ type: "added", doc: docSnap(row.path, row), oldIndex: -1, newIndex: i });
      } else if (prevJson[row.path] !== nextJson[row.path]) {
        changes.push({ type: "modified", doc: docSnap(row.path, row), oldIndex: -1, newIndex: i });
      }
    });
    return changes;
  }

  function Query(spec) {
    this.spec = {
      kind: spec.kind,
      path: spec.path || "",
      collectionPath: spec.collectionPath || "",
      groupId: spec.groupId || "",
      filters: (spec.filters || []).slice(),
      orders: (spec.orders || []).slice(),
      limitN: spec.limitN != null ? spec.limitN : null
    };
  }

  Query.prototype.where = function (field, op, value) {
    var next = new Query(this.spec);
    next.spec.filters.push({ field: field, op: op, value: value });
    return next;
  };

  Query.prototype.orderBy = function (field, dir) {
    var next = new Query(this.spec);
    next.spec.orders.push({ field: field, dir: dir === "desc" ? "desc" : "asc" });
    return next;
  };

  Query.prototype.limit = function (n) {
    var next = new Query(this.spec);
    next.spec.limitN = n;
    return next;
  };

  Query.prototype.get = function () {
    var spec = this.spec;
    return loadAll().then(function () {
      return querySnap(selectRows(spec), null);
    });
  };

  Query.prototype.onSnapshot = function (onNext, onError) {
    if (onNext && typeof onNext === "object") {
      onError = onNext.error;
      onNext = onNext.next;
    }
    var spec = this.spec;
    var prev = null;
    var entry = {
      onError: typeof onError === "function" ? onError : null,
      emit: function () {
        var rows = selectRows(spec);
        var changes = diffChanges(prev, rows);
        var nextPrev = {};
        rows.forEach(function (row) {
          nextPrev[row.path] = JSON.stringify(row.data);
        });
        prev = nextPrev;
        if (typeof onNext === "function") onNext(querySnap(rows, changes));
      }
    };
    return track(entry);
  };

  function CollectionRef(collectionPath) {
    var parts = String(collectionPath || "").split("/").filter(Boolean);
    Query.call(this, {
      kind: "collection",
      collectionPath: parts.join("/"),
      filters: [],
      orders: [],
      limitN: null
    });
    this.path = parts.join("/");
    this.id = parts.length ? parts[parts.length - 1] : "";
    this.parent = parts.length > 1 ? new DocRef(parts.slice(0, -1).join("/")) : null;
  }

  CollectionRef.prototype = Object.create(Query.prototype);
  CollectionRef.prototype.constructor = CollectionRef;

  CollectionRef.prototype.doc = function (id) {
    var docId = id == null || id === "" ? autoId() : String(id);
    return new DocRef(this.path ? this.path + "/" + docId : docId);
  };

  CollectionRef.prototype.add = function (data) {
    var ref = this.doc();
    return ref.set(data).then(function () {
      return ref;
    });
  };

  DocRef.prototype.collection = function (name) {
    var child = String(name || "").replace(/^\/+|\/+$/g, "");
    return new CollectionRef(this.path + "/" + child);
  };

  DocRef.prototype.get = function () {
    var path = this.path;
    return loadAll().then(function () {
      return docSnap(path, cache.get(path) || null);
    });
  };

  DocRef.prototype.set = function (data, options) {
    var merge = !!(options && options.merge);
    var path = this.path;
    var self = this;
    return loadAll().then(function () {
      var existing = cache.get(path);
      if (!merge && !existing) {
        return writeRow(self, serializeValue(data || {}));
      }
      var base = existing ? existing.data : {};
      var next = merge ? mergeMaps(base, data || {}) : serializeValue(data || {});
      return writeRow(self, next);
    });
  };

  DocRef.prototype.update = function (data) {
    var path = this.path;
    var self = this;
    return loadAll().then(function () {
      var existing = cache.get(path);
      if (!existing) {
        throw fsError("not-found", "No existe el documento " + path);
      }
      return writeRow(self, applyUpdate(existing.data, data || {}));
    });
  };

  DocRef.prototype.delete = function () {
    var path = this.path;
    return request("DELETE", "/rest/v1/" + TABLE + "?" + eqFilter("path", path))
      .then(function () {
        noteWrite(path, null);
      })
      .catch(function (err) {
        if (err && err.code === "not-found") {
          noteWrite(path, null);
          return;
        }
        throw err;
      });
  };

  DocRef.prototype.onSnapshot = function (onNext, onError) {
    if (onNext && typeof onNext === "object") {
      onError = onNext.error;
      onNext = onNext.next;
    }
    var path = this.path;
    var entry = {
      onError: typeof onError === "function" ? onError : null,
      emit: function () {
        if (typeof onNext === "function") onNext(docSnap(path, cache.get(path) || null));
      }
    };
    return track(entry);
  };

  function writeRow(ref, data) {
    var row = {
      path: ref.path,
      collection_path: ref.parent && ref.parent.path ? ref.parent.path : parentPath(ref.path),
      doc_id: ref.id,
      data: data || {},
      updated_at: new Date().toISOString()
    };
    return request("POST", "/rest/v1/" + TABLE + "?on_conflict=path", row, {
      Prefer: "resolution=merge-duplicates,return=minimal"
    })
      .catch(function (err) {
        if (err && (err.status === 400 || err.status === 405 || err.status === 409)) {
          return request(
            "PATCH",
            "/rest/v1/" + TABLE + "?" + eqFilter("path", row.path),
            {
              collection_path: row.collection_path,
              doc_id: row.doc_id,
              data: row.data,
              updated_at: row.updated_at
            },
            { Prefer: "return=minimal" }
          );
        }
        throw err;
      })
      .then(function () {
        noteWrite(ref.path, normalizeRow(row));
      });
  }

  function autoId() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var bytes = new Uint8Array(20);
    if (global.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = "";
    for (var n = 0; n < bytes.length; n++) out += chars[bytes[n] % chars.length];
    return out;
  }

  function createBatch() {
    var ops = [];
    return {
      set: function (ref, data, options) {
        ops.push({ type: "set", ref: ref, data: data, options: options || null });
        return this;
      },
      update: function (ref, data) {
        ops.push({ type: "update", ref: ref, data: data });
        return this;
      },
      delete: function (ref) {
        ops.push({ type: "delete", ref: ref });
        return this;
      },
      commit: function () {
        var chain = Promise.resolve();
        ops.forEach(function (op) {
          chain = chain.then(function () {
            if (op.type === "set") return op.ref.set(op.data, op.options);
            if (op.type === "update") return op.ref.update(op.data);
            if (op.type === "delete") return op.ref.delete();
          });
        });
        return chain;
      }
    };
  }

  function notify() {
    listeners.slice().forEach(function (entry) {
      try {
        entry.emit();
      } catch (err) {
        if (entry.onError) entry.onError(err);
      }
    });
  }

  function ensurePoll() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      loadAll()
        .then(function () {
          notify();
        })
        .catch(function (err) {
          console.warn("[supabase]", err && err.message ? err.message : err);
        });
    }, POLL_MS);
  }

  function track(entry) {
    listeners.push(entry);
    ensurePoll();
    loadAll()
      .then(function () {
        entry.emit();
      })
      .catch(function (err) {
        if (entry.onError) entry.onError(err);
        else console.warn("[supabase]", err && err.message ? err.message : err);
      });
    return function () {
      var i = listeners.indexOf(entry);
      if (i >= 0) listeners.splice(i, 1);
      if (!listeners.length && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }

  function childCollectionIds(parentDocPath) {
    var prefix = String(parentDocPath || "").replace(/\/+$/, "") + "/";
    var ids = {};
    cache.forEach(function (row) {
      if (row.path.indexOf(prefix) !== 0) return;
      var seg = row.path.slice(prefix.length).split("/")[0];
      if (seg) ids[seg] = true;
    });
    return Object.keys(ids);
  }

  function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  function installFetchBridge() {
    if (typeof global.fetch !== "function") return false;
    if (global.fetch.__supabaseBridge) return true;
    var orig = global.fetch.bind(global);
    function wrapped(input, init) {
      var url = typeof input === "string" ? input : input && input.url ? input.url : "";
      if (!enabled() || url.indexOf("firestore.googleapis.com/v1/") === -1) {
        return orig(input, init);
      }
      var parsed;
      try {
        parsed = new URL(url, global.location ? global.location.href : undefined);
      } catch (e) {
        return orig(input, init);
      }
      var marker = "/documents/";
      var idx = parsed.pathname.indexOf(marker);
      if (idx === -1) return orig(input, init);
      var rest = parsed.pathname.slice(idx + marker.length);
      var listCols = /:listCollectionIds$/.test(rest);
      rest = rest.replace(/:listCollectionIds$/, "");
      var docPath = rest
        .split("/")
        .filter(Boolean)
        .map(function (seg) {
          try {
            return decodeURIComponent(seg);
          } catch (e2) {
            return seg;
          }
        })
        .join("/");
      return loadAll().then(function () {
        if (listCols) {
          return jsonResponse({ collectionIds: childCollectionIds(docPath) });
        }
        var project = (cfg().projectId || "check-list-9e21f");
        var documents = selectRows({
          kind: "collection",
          collectionPath: docPath,
          filters: [],
          orders: [],
          limitN: null
        }).map(function (row) {
          return {
            name:
              "projects/" +
              project +
              "/databases/(default)/documents/" +
              row.path
          };
        });
        return jsonResponse({ documents: documents });
      });
    }
    wrapped.__supabaseBridge = true;
    global.fetch = wrapped;
    fetchPatched = true;
    return true;
  }

  function createDb() {
    return {
      collection: function (name) {
        return new CollectionRef(String(name || ""));
      },
      collectionGroup: function (name) {
        return new Query({
          kind: "group",
          groupId: String(name || ""),
          filters: [],
          orders: [],
          limitN: null
        });
      },
      doc: function (path) {
        return new DocRef(String(path || ""));
      },
      batch: function () {
        return createBatch();
      }
    };
  }

  function getDb() {
    if (!dbSingleton) dbSingleton = createDb();
    return dbSingleton;
  }

  var FieldValue = {
    serverTimestamp: function () {
      return new Sentinel("serverTimestamp");
    },
    delete: function () {
      return new Sentinel("deleteField");
    }
  };

  function install() {
    if (!enabled() || !global.firebase) return false;
    if (global.firebase.firestore && global.firebase.firestore.__supabase) return true;
    function firestoreFn() {
      return getDb();
    }
    firestoreFn.__supabase = true;
    firestoreFn.FieldValue = FieldValue;
    firestoreFn.Timestamp = Timestamp;
    global.firebase.firestore = firestoreFn;
    global.__supabaseFirestoreInstalled = true;
    return true;
  }

  installFetchBridge();
  global.__installSupabaseFirestore = install;
  install();

  var tries = 0;
  var watch = setInterval(function () {
    tries += 1;
    installFetchBridge();
    install();
    if (tries > 150) clearInterval(watch);
  }, 200);
})(typeof window !== "undefined" ? window : this);
