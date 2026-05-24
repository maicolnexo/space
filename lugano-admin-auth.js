/**
 * Verificación de cuenta en Firestore «administradores» (tras Google Sign-In).
 * Requiere: firebase-config.js, firebase-app-compat, firebase-auth-compat, firebase-firestore-compat.
 */
(function (global) {
  "use strict";

  var ADMIN_SESSION_KEY = "lugano-admin-session-v1";

  function cfg() {
    return typeof firebaseConfig !== "undefined" ? firebaseConfig : {};
  }

  function adminCol() {
    return cfg().administradoresCollection || "administradores";
  }

  function db() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    return firebase.firestore();
  }

  function sha256HexUtf8(str) {
    if (!global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error("El navegador no admite verificación segura (use HTTPS)."));
    }
    var enc = new TextEncoder().encode(str);
    return global.crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) {
          return ("0" + b.toString(16)).slice(-2);
        })
        .join("");
    });
  }

  function normalizeEmail(email) {
    return String(email || "")
      .trim()
      .toLowerCase();
  }

  function getAdminSession() {
    try {
      var raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.adminId) return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  function setAdminSession(sess) {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sess));
    } catch (e) {}
  }

  function clearAdminSession() {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch (e) {}
  }

  function isAdminSessionValidForUser(user) {
    if (!user) return false;
    var sess = getAdminSession();
    if (!sess || !sess.adminId) return false;
    if (sess.googleUid && sess.googleUid !== user.uid) return false;
    return true;
  }

  function isFullyAuthenticated(user) {
    return !!(user && isAdminSessionValidForUser(user));
  }

  function adminIsActive(data) {
    if (!data) return false;
    if (data.active === false || data.activo === false) return false;
    return true;
  }

  function verifyAdminPassword(plain, data) {
    if (!plain || !data) return Promise.resolve(false);
    var enc = String(data.passwordEncrypted || "");
    var salt = String(data.salt || "");

    if (enc.indexOf(":") >= 0) {
      var parts = enc.split(":");
      var expectedHash = parts[0];
      var saltHex = parts[1] || salt;
      return sha256HexUtf8(plain + saltHex).then(function (computed) {
        return (
          computed === expectedHash ||
          computed.toLowerCase() === String(expectedHash).toLowerCase()
        );
      });
    }

    if (salt) {
      return sha256HexUtf8(plain + salt).then(function (c1) {
        if (c1 === enc || c1.toLowerCase() === enc.toLowerCase()) return true;
        return sha256HexUtf8(salt + plain).then(function (c2) {
          return c2 === enc || c2.toLowerCase() === enc.toLowerCase();
        });
      });
    }

    return Promise.resolve(enc === plain);
  }

  function findAdminDocByEmail(email) {
    var fire = db();
    if (!fire) return Promise.reject(new Error("Firestore no disponible."));
    var norm = normalizeEmail(email);
    if (!norm) return Promise.resolve(null);

    function queryByEmail(val) {
      return fire.collection(adminCol()).where("email", "==", val).limit(1).get();
    }

    return queryByEmail(norm).then(function (snap) {
      if (!snap.empty) return snap.docs[0];
      var trimmed = String(email || "").trim();
      if (!trimmed || trimmed === norm) return null;
      return queryByEmail(trimmed).then(function (snap2) {
        return snap2.empty ? null : snap2.docs[0];
      });
    });
  }

  function findAdminDocForGoogleUser(user) {
    var fire = db();
    if (!fire || !user) return Promise.resolve(null);
    var email = user.email ? normalizeEmail(user.email) : "";

    return fire
      .collection(adminCol())
      .doc(user.uid)
      .get()
      .then(function (byUid) {
        if (byUid.exists && adminIsActive(byUid.data())) return byUid;
        if (!email) return null;
        return findAdminDocByEmail(email).then(function (doc) {
          return doc;
        });
      });
  }

  function authenticateAdmin(email, password, googleUser) {
    if (!googleUser) {
      return Promise.reject(new Error("Debe iniciar sesión con Google primero."));
    }
    var mail = normalizeEmail(email);
    if (!mail) return Promise.reject(new Error("Indique el correo de administración."));
    if (!password) return Promise.reject(new Error("Indique la contraseña de administración."));

    return findAdminDocByEmail(mail).then(function (doc) {
      if (!doc) {
        return findAdminDocForGoogleUser(googleUser).then(function (doc2) {
          if (!doc2) {
            throw new Error("No hay cuenta de administración registrada con ese correo.");
          }
          if (normalizeEmail(doc2.data().email) !== mail) {
            throw new Error("El correo no coincide con la cuenta de administración.");
          }
          return doc2;
        });
      }
      return doc;
    }).then(function (doc) {
      var data = doc.data() || {};
      if (!adminIsActive(data)) {
        throw new Error("La cuenta de administración está inactiva.");
      }
      return verifyAdminPassword(password, data).then(function (ok) {
        if (!ok) throw new Error("Contraseña de administración incorrecta.");
        setAdminSession({
          adminId: doc.id,
          email: data.email || mail,
          nombre: data.nombre || "",
          rol: data.rol || "",
          googleUid: googleUser.uid,
          at: Date.now(),
        });
        return { doc: doc, data: data };
      });
    });
  }

  function verifyCurrentAdminPassword(googleUser, password) {
    if (!googleUser) {
      return Promise.reject(new Error("Debe iniciar sesión con Google."));
    }
    if (!password) {
      return Promise.reject(new Error("Indique la contraseña de administración."));
    }
    return findAdminDocForGoogleUser(googleUser).then(function (doc) {
      if (!doc) {
        throw new Error("No hay cuenta de administración vinculada a este usuario.");
      }
      var data = doc.data() || {};
      if (!adminIsActive(data)) {
        throw new Error("La cuenta de administración está inactiva.");
      }
      return verifyAdminPassword(password, data).then(function (ok) {
        if (!ok) throw new Error("Contraseña de administración incorrecta.");
        return { doc: doc, data: data };
      });
    });
  }

  global.LuganoAdminAuth = {
    ADMIN_SESSION_KEY: ADMIN_SESSION_KEY,
    adminCol: adminCol,
    getAdminSession: getAdminSession,
    setAdminSession: setAdminSession,
    clearAdminSession: clearAdminSession,
    isAdminSessionValidForUser: isAdminSessionValidForUser,
    isFullyAuthenticated: isFullyAuthenticated,
    authenticateAdmin: authenticateAdmin,
    findAdminDocForGoogleUser: findAdminDocForGoogleUser,
    verifyCurrentAdminPassword: verifyCurrentAdminPassword,
  };
})(typeof window !== "undefined" ? window : this);
