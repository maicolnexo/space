/**
 * Lógica compartida: lectura de cierres Firestore (misma base que estadistico.html / estacionamientos.html).
 * Uso: var api = createLuganoCierresApi(cfg, firebaseConfig); await api.fetchCierresTree(db, auth);
 */
(function (global) {
  function pick(data) {
    if (!data) return "";
    var keys = Array.prototype.slice.call(arguments, 1);
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (data[k] !== undefined && data[k] !== null && data[k] !== "") return data[k];
    }
    return "";
  }

  function uniqueStrings(arr) {
    var seen = {};
    var out = [];
    (arr || []).forEach(function (x) {
      var s = String(x == null ? "" : x).trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    });
    return out;
  }

  function extractRecaudoNumberPlain(data) {
    if (!data || typeof data !== "object") return 0;
    var prefer = [
      "grandTotal",
      "cashTotal",
      "vouchersTotal",
      "totalRecaudo",
      "recaudoTotal",
      "recaudo",
      "total",
      "montoTotal",
      "monto",
      "valorTotal",
      "valor",
      "ingresos",
      "efectivo",
      "totalDia",
      "cierreMonto",
      "cierre",
      "subtotal"
    ];
    var i, v;
    for (i = 0; i < prefer.length; i++) {
      v = data[prefer[i]];
      if (typeof v === "number" && !isNaN(v)) return v;
      if (typeof v === "string" && /^\s*[\d.,]+\s*$/.test(v)) {
        var n = Number(String(v).replace(/\./g, "").replace(",", "."));
        if (!isNaN(n)) return n;
      }
    }
    var sum = 0;
    var found = false;
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      if (k === "encryptedData" || k === "encrypted_data") continue;
      v = data[k];
      if (typeof v === "number" && !isNaN(v) && v >= 0) {
        sum += v;
        found = true;
      }
    }
    return found ? sum : 0;
  }

  function isLikelyCashClosingPayload(o) {
    return (
      o &&
      typeof o === "object" &&
      ("grandTotal" in o ||
        "cashTotal" in o ||
        "vouchersTotal" in o ||
        "parkingName" in o ||
        "operatorName" in o)
    );
  }

  function shouldAcceptRecaudoAmount(m, inner) {
    if (typeof m !== "number" || isNaN(m)) return false;
    if (m > 0) return true;
    return isLikelyCashClosingPayload(inner);
  }

  function tryParseEncryptedPayloadRaw(raw) {
    if (raw == null) return null;
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (typeof raw !== "string") return null;
    var s = raw.trim();
    if (!s) return null;
    if (s.charAt(0) === "{" || s.charAt(0) === "[") {
      try {
        return JSON.parse(s);
      } catch (e) {}
    }
    var s64 = s.replace(/\s+/g, "");
    try {
      var bin = atob(s64.replace(/-/g, "+").replace(/_/g, "/"));
      var utf8 = decodeURIComponent(
        Array.prototype.map
          .call(bin, function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(utf8);
    } catch (e1) {}
    try {
      var bin2 = atob(s64.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(bin2);
    } catch (e2) {}
    return null;
  }

  function base64ToUint8(str) {
    var t = String(str).replace(/\s+/g, "");
    var bin = atob(t.replace(/-/g, "+").replace(/_/g, "/"));
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function createLuganoCierresApi(cfg, firebaseConfig) {
    cfg = cfg || {};

    async function deriveAesKeyFromSecret(secret) {
      var enc = new TextEncoder().encode(String(secret));
      var hash = await crypto.subtle.digest("SHA-256", enc);
      return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
    }

    async function importCashClosingCbcKey(userSuffix) {
      var a =
        cfg.cierresCashClosingSecretKey != null
          ? cfg.cierresCashClosingSecretKey
          : "CashClosing2024!@#$%^&*()_+Secure";
      var b =
        cfg.cierresCashClosingAdditionalKey != null
          ? cfg.cierresCashClosingAdditionalKey
          : "LuganoParkingCashClosing2024!Secure";
      var u = userSuffix != null ? String(userSuffix) : "";
      var combined = a + b + u;
      var hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(combined));
      return crypto.subtle.importKey("raw", hash, { name: "AES-CBC" }, false, ["decrypt"]);
    }

    async function tryDecryptCashClosingKotlinCompat(base64Str, userSuffix) {
      if (!base64Str || typeof base64Str !== "string" || !crypto || !crypto.subtle) return null;
      try {
        var buf = base64ToUint8(base64Str);
        if (buf.length < 32) return null;
        var iv = buf.slice(0, 16);
        var ciphertext = buf.slice(16);
        var key = await importCashClosingCbcKey(userSuffix);
        var plainBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv: iv }, key, ciphertext);
        var txt = new TextDecoder().decode(plainBuf);
        return JSON.parse(txt);
      } catch (e) {
        return null;
      }
    }

    async function tryDecryptCashClosingAndroidCompat(base64Str) {
      if (!base64Str || typeof base64Str !== "string") return null;
      var primary =
        cfg.cierresCashClosingUserNameSuffix != null ? String(cfg.cierresCashClosingUserNameSuffix) : "";
      var chain = [primary];
      ["", "unknown", "root"].forEach(function (s) {
        if (chain.indexOf(s) === -1) chain.push(s);
      });
      var i, parsed;
      for (i = 0; i < chain.length; i++) {
        parsed = await tryDecryptCashClosingKotlinCompat(base64Str, chain[i]);
        if (parsed && typeof parsed === "object") return parsed;
      }
      return null;
    }

    async function tryDecryptAesGcmPayload(secret, encryptedBase64, ivSeparate, ivPrepended) {
      if (!secret || !encryptedBase64 || typeof encryptedBase64 !== "string") return null;
      if (!crypto || !crypto.subtle) return null;
      try {
        var key = await deriveAesKeyFromSecret(secret);
        var iv;
        var ciphertext;
        if (ivSeparate != null && ivSeparate !== "") {
          iv =
            typeof ivSeparate === "string"
              ? base64ToUint8(ivSeparate)
              : ivSeparate instanceof Uint8Array
                ? ivSeparate
                : null;
          ciphertext = base64ToUint8(encryptedBase64.trim());
        } else if (ivPrepended !== false) {
          var buf = base64ToUint8(encryptedBase64.trim());
          if (buf.length < 28) return null;
          var ivLens = [12, 16];
          for (var li = 0; li < ivLens.length; li++) {
            var il = ivLens[li];
            if (buf.length < il + 16) continue;
            iv = buf.slice(0, il);
            ciphertext = buf.slice(il);
            try {
              var plainBuf2 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
              var txt2 = new TextDecoder().decode(plainBuf2);
              try {
                return JSON.parse(txt2);
              } catch (eJ2) {}
            } catch (eDec) {}
          }
          return null;
        } else {
          return null;
        }
        if (!iv || !iv.length || !ciphertext || !ciphertext.length) return null;
        var plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
        var txt = new TextDecoder().decode(plainBuf);
        try {
          return JSON.parse(txt);
        } catch (eJ) {
          return null;
        }
      } catch (e) {
        return null;
      }
    }

    /**
     * Una sola pasada por cierre: monto + inner para UI (evita duplicar descifrados AES costosos).
     * Compat tryGetInnerPayload: si el parse devuelve un objeto, ese inner gana aunque el monto venga de otro paso.
     */
    async function extractRecaudoAndInnerFromCierreAsync(data) {
      if (!data || typeof data !== "object") return { monto: 0, inner: null };
      var encField = cfg.cierresEncryptedField || "encryptedData";
      var ivSep = pick(data, "iv", "IV", "aesIv", "nonce");
      var enc = data[encField];
      if (enc === undefined || enc === null || enc === "") enc = data.encrypted_data;
      if (enc && typeof enc === "object" && enc.ciphertext != null) {
        ivSep = ivSep || pick(enc, "iv", "IV", "aesIv", "nonce");
        enc = enc.ciphertext;
      }

      var innerUi = null;

      if (enc !== undefined && enc !== null && enc !== "") {
        var inner = tryParseEncryptedPayloadRaw(enc);
        if (inner && typeof inner === "object") {
          innerUi = inner;
        }
        if (inner) {
          var m = extractRecaudoNumberPlain(inner);
          if (shouldAcceptRecaudoAmount(m, inner)) {
            return { monto: m, inner: innerUi };
          }
        }
        inner = await tryDecryptCashClosingAndroidCompat(typeof enc === "string" ? enc : "");
        if (inner && typeof inner === "object") {
          if (!innerUi) innerUi = inner;
          m = extractRecaudoNumberPlain(inner);
          if (shouldAcceptRecaudoAmount(m, inner)) {
            return { monto: m, inner: innerUi };
          }
        }
        var secret = cfg.cierresPayloadSecret;
        if (secret) {
          if (ivSep && typeof ivSep !== "string") ivSep = String(ivSep);
          inner = await tryDecryptAesGcmPayload(
            secret,
            typeof enc === "string" ? enc : "",
            ivSep || null,
            cfg.cierresEncryptedIvPrepended !== false
          );
          if (inner && typeof inner === "object") {
            if (!innerUi) innerUi = inner;
            m = extractRecaudoNumberPlain(inner);
            if (shouldAcceptRecaudoAmount(m, inner)) {
              return { monto: m, inner: innerUi };
            }
          }
        }
        return { monto: extractRecaudoNumberPlain(data), inner: innerUi };
      }
      return { monto: extractRecaudoNumberPlain(data), inner: null };
    }

    async function extractRecaudoFromCierreAsync(data) {
      var r = await extractRecaudoAndInnerFromCierreAsync(data);
      return r.monto;
    }

    /** Intenta devolver objeto interior descifrado o parseado para mostrar en UI. */
    async function tryGetInnerPayload(data) {
      var r = await extractRecaudoAndInnerFromCierreAsync(data);
      return r.inner;
    }

    function listCollectionIdsRESTForFullPath(fullDocPath, auth) {
      var projectId = firebaseConfig.projectId;
      var segments = fullDocPath.split("/").filter(Boolean);
      var encodedPath = segments.map(encodeURIComponent).join("/");
      var docResource = "projects/" + projectId + "/databases/(default)/documents/" + encodedPath;
      var url = "https://firestore.googleapis.com/v1/" + docResource + ":listCollectionIds";
      return auth.currentUser.getIdToken().then(function (token) {
        return fetch(url, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: "{}"
        }).then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) {
              throw new Error(res.status + " " + t);
            });
          }
          return res.json();
        });
      });
    }

    function listDocumentsInCollectionREST(collectionId, auth) {
      var projectId = firebaseConfig.projectId;
      var collected = [];
      function fetchPage(pageToken) {
        var qs =
          "pageSize=300" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
        var url =
          "https://firestore.googleapis.com/v1/projects/" +
          projectId +
          "/databases/(default)/documents/" +
          encodeURIComponent(collectionId) +
          "?" +
          qs;
        return auth.currentUser.getIdToken().then(function (token) {
          return fetch(url, {
            headers: { Authorization: "Bearer " + token }
          }).then(function (res) {
            if (!res.ok) {
              return res.text().then(function (t) {
                throw new Error(res.status + " " + t);
              });
            }
            return res.json();
          });
        }).then(function (data) {
          (data.documents || []).forEach(function (doc) {
            var name = doc.name || "";
            var segs = name.split("/");
            var idRaw = segs.length ? segs[segs.length - 1] : "";
            try {
              collected.push(decodeURIComponent(idRaw));
            } catch (eDec) {
              collected.push(idRaw);
            }
          });
          if (data.nextPageToken) {
            return fetchPage(data.nextPageToken);
          }
          return collected;
        });
      }
      return fetchPage(null);
    }

    function decodeURIComponentSafe(seg) {
      try {
        return decodeURIComponent(String(seg));
      } catch (e) {
        return String(seg);
      }
    }

    async function discoverCierresParkingIdsViaCollectionGroups(db, operatorSubcollectionNames) {
      var sedes = {};
      var names = uniqueStrings(operatorSubcollectionNames || []);
      await Promise.all(
        names.map(function (op) {
          return db
            .collectionGroup(op)
            .get()
            .then(function (snap) {
              snap.docs.forEach(function (doc) {
                var parts = doc.ref.path.split("/").filter(Boolean);
                if (parts[0] !== "cierres" || parts.length < 3) return;
                sedes[parts[1]] = true;
              });
            })
            .catch(function () {});
        })
      );
      return Object.keys(sedes);
    }

    function operatorPathSegmentFromDisplayName(name) {
      if (name == null || name === "") return "";
      try {
        return String(name)
          .normalize("NFC")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      } catch (e) {
        return String(name).trim().toLowerCase().replace(/\s+/g, " ");
      }
    }

    async function fetchOperatorSubcollectionNames(db) {
      var names = [];
      (cfg.cierresOperatorSubcollectionsFallback || []).forEach(function (x) {
        names.push(operatorPathSegmentFromDisplayName(x));
      });
      var opCol = cfg.cierresOperatorsCollection;
      if (opCol) {
        try {
          var snap = await db.collection(opCol).get();
          snap.docs.forEach(function (d) {
            var data = d.data() || {};
            var raw = pick(data, "name", "nombre", "operatorName", "displayName");
            if (raw) names.push(operatorPathSegmentFromDisplayName(raw));
          });
        } catch (e) {}
      }
      return uniqueStrings(names.filter(Boolean));
    }

    async function fetchCierresTree(db, auth) {
      var col = cfg.cierresCollection || "cierres";
      var operatorNamesGlobal = await fetchOperatorSubcollectionNames(db);
      var builtinCgProbes = [
        "michael eduardo carreño sanchez",
        "luis jimenez",
        "administrador",
        "operario",
        "admin"
      ];
      var probeOps = uniqueStrings(
        (operatorNamesGlobal || [])
          .concat(cfg.cierresCollectionGroupProbeOperators || [])
          .concat(builtinCgProbes)
      );

      var sedesSnap = { docs: [] };
      try {
        sedesSnap = await db.collection(col).get();
      } catch (e) {}

      var fromSdk = sedesSnap.docs.map(function (d) {
        return d.id;
      });
      var fromRest = [];
      if (auth.currentUser) {
        try {
          fromRest = await listDocumentsInCollectionREST(col, auth);
        } catch (e) {}
      }
      var fromCg = [];
      if (probeOps.length) {
        fromCg = await discoverCierresParkingIdsViaCollectionGroups(db, probeOps);
      }
      var sedeIds = uniqueStrings(fromSdk.concat(fromRest).concat(fromCg));

      var treeParts = await Promise.all(
        sedeIds.map(async function (sedeId) {
          var sedeRef = db.collection(col).doc(sedeId);
          var json = { collectionIds: [] };
          try {
            json = await listCollectionIdsRESTForFullPath(sedeRef.path, auth);
          } catch (err) {
            json = { collectionIds: [] };
          }
          var fromRestSubs = json.collectionIds || [];
          var operarios = uniqueStrings(fromRestSubs.concat(probeOps));
          if (!operarios.length) return null;

          var opResults = await Promise.all(
            operarios.map(async function (opId) {
              var snap = await sedeRef.collection(opId).get();
              if (!snap.size) return null;
              var cierres = await Promise.all(
                snap.docs.map(async function (cdoc) {
                  var raw = cdoc.data() || {};
                  var ex = await extractRecaudoAndInnerFromCierreAsync(raw);
                  return {
                    id: cdoc.id,
                    monto: ex.monto,
                    raw: raw,
                    inner: ex.inner
                  };
                })
              );
              var totalOp = cierres.reduce(function (a, x) {
                return a + x.monto;
              }, 0);
              return {
                opId: opId,
                displayLabel: decodeURIComponentSafe(opId),
                total: totalOp,
                cierres: cierres
              };
            })
          );

          var ops = opResults.filter(Boolean);
          if (!ops.length) return null;
          var sedeTotal = ops.reduce(function (a, x) {
            return a + x.total;
          }, 0);
          return {
            sedeId: sedeId,
            displayLabel: decodeURIComponentSafe(sedeId),
            total: sedeTotal,
            operarios: ops
          };
        })
      );

      var tree = treeParts.filter(Boolean);

      tree.sort(function (a, b) {
        return b.total - a.total;
      });
      return tree;
    }

    function fmtCop(n) {
      try {
        return new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0
        }).format(n);
      } catch (e) {
        return String(n);
      }
    }

    return {
      fetchCierresTree: fetchCierresTree,
      extractRecaudoFromCierreAsync: extractRecaudoFromCierreAsync,
      tryGetInnerPayload: tryGetInnerPayload,
      fmtCop: fmtCop
    };
  }

  global.createLuganoCierresApi = createLuganoCierresApi;
})(typeof window !== "undefined" ? window : globalThis);
