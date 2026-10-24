/**
 * Convierte referencias de foto (URL de Cloudinary, URL de Firebase Storage,
 * gs:// o ruta inspection_photos/…) en una URL de entrega de Cloudinary.
 */
(function (global) {
  function cfg() {
    if (typeof firebaseConfig !== "undefined" && firebaseConfig) return firebaseConfig;
    return global.firebaseConfig || {};
  }

  function cloudName() {
    return String(cfg().cloudinaryCloudName || "huf6reyb").trim();
  }

  function resourceKind(publicId) {
    return /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|3gp)(\?|#|$)/i.test(publicId) ? "video" : "image";
  }

  function deliveryFromPublicId(publicId) {
    var id = String(publicId || "")
      .replace(/^\/+/, "")
      .split("?")[0]
      .split("#")[0];
    if (!id || !cloudName()) return "";
    return (
      "https://res.cloudinary.com/" +
      cloudName() +
      "/" +
      resourceKind(id) +
      "/upload/" +
      id
    );
  }

  function publicIdFromFirebaseUrl(url) {
    var m = String(url || "").match(/\/o\/([^?]+)/);
    if (!m) return "";
    var seg = m[1].replace(/\+/g, " ");
    try {
      return decodeURIComponent(seg);
    } catch (e) {
      return seg;
    }
  }

  function toDeliveryUrl(raw) {
    var s = String(raw || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .replace(/^["']+|["']+$/g, "");
    if (!s) return "";
    var low = s.toLowerCase();
    if (low.indexOf("file:") === 0 || low.indexOf("content:") === 0 || low.indexOf("blob:") === 0) {
      return "";
    }
    if (/^https?:\/\/res\.cloudinary\.com\//i.test(s)) return s;
    if (low.indexOf("//res.cloudinary.com/") === 0) return "https:" + s;
    if (/firebasestorage\.googleapis\.com/i.test(s) || /\/v0\/b\/[^/]+\/o\//i.test(s)) {
      return deliveryFromPublicId(publicIdFromFirebaseUrl(s));
    }
    if (low.indexOf("gs://") === 0) {
      return deliveryFromPublicId(s.replace(/^gs:\/\/[^/]+\//i, ""));
    }
    if (/^inspection_photos\//i.test(s)) return deliveryFromPublicId(s);
    if (
      s.indexOf("/") !== -1 &&
      s.indexOf(":") === -1 &&
      /\.(jpe?g|png|webp|gif|mp4|webm|mov|m4v)(\?.*)?$/i.test(s)
    ) {
      return deliveryFromPublicId(s.replace(/^\/+/, ""));
    }
    if (low.indexOf("http://") === 0 || low.indexOf("https://") === 0) return s;
    return "";
  }

  function resolveList(candidates) {
    var out = [];
    var seen = {};
    (candidates || []).forEach(function (raw) {
      var url = toDeliveryUrl(raw);
      if (!url || seen[url]) return;
      seen[url] = true;
      out.push(url);
    });
    return out;
  }

  global.LuganoMedia = {
    cloudName: cloudName,
    toDeliveryUrl: toDeliveryUrl,
    resolveList: resolveList
  };
})(typeof window !== "undefined" ? window : this);
