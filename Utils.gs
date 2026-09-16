/**
 * Utils.gs
 * Funcoes utilitarias compartilhadas pelo backend.
 */
var Utils = {

  /** @return {string} UUID novo. */
  uuid: function () {
    return Utilities.getUuid();
  },

  /** @return {string} Timestamp atual em ISO 8601. */
  nowIso: function () {
    return new Date().toISOString();
  },

  /**
   * @param {*} value
   * @return {boolean} true para null, undefined ou string so com espacos.
   */
  isBlank: function (value) {
    return value === null || value === undefined ||
           (typeof value === 'string' && value.trim() === '');
  },

  /**
   * @param {*} value
   * @return {string} String aparada; '' para valores nulos.
   */
  str: function (value) {
    return Utils.isBlank(value) ? '' : String(value).trim();
  },

  /**
   * @param {*} value
   * @param {number=} fallback
   * @return {number}
   */
  toInt: function (value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  },

  /**
   * @param {*} value
   * @param {number=} fallback
   * @return {number}
   */
  toNumber: function (value, fallback) {
    var n = Number(value);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  },

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @return {number}
   */
  clamp: function (value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Copia profunda via JSON. Serve para objetos de dados simples.
   * @param {*} obj
   * @return {*}
   */
  clone: function (obj) {
    return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
  },

  /**
   * Remove chaves com valor undefined.
   * @param {!Object} obj
   * @return {!Object}
   */
  compact: function (obj) {
    var out = {};
    Object.keys(obj).forEach(function (key) {
      if (obj[key] !== undefined) out[key] = obj[key];
    });
    return out;
  },

  /**
   * Copia apenas as chaves indicadas.
   * @param {!Object} obj
   * @param {!Array<string>} keys
   * @return {!Object}
   */
  pick: function (obj, keys) {
    var out = {};
    keys.forEach(function (key) {
      if (obj[key] !== undefined) out[key] = obj[key];
    });
    return out;
  },

  /**
   * Copia o objeto sem as chaves indicadas.
   * @param {!Object} obj
   * @param {!Array<string>} keys
   * @return {!Object}
   */
  omit: function (obj, keys) {
    var out = {};
    Object.keys(obj).forEach(function (key) {
      if (keys.indexOf(key) === -1) out[key] = obj[key];
    });
    return out;
  },

  /**
   * Normaliza nome de usuario para comparacao (minusculo, sem espacos).
   * @param {*} username
   * @return {string}
   */
  normalizeUsername: function (username) {
    return Utils.str(username).toLowerCase();
  },

  /**
   * Remove caracteres de controle e limita o tamanho de um texto livre.
   * @param {*} value
   * @param {number=} maxLength
   * @return {string}
   */
  sanitize: function (value, maxLength) {
    var CONTROL_CHARS = new RegExp('[\\x00-\\x1F\\x7F]', 'g');
    var text = Utils.str(value).replace(CONTROL_CHARS, '');
    var limit = maxLength || 500;
    return text.length > limit ? text.substring(0, limit) : text;
  },

  /**
   * Ordena uma copia do array por campo numerico.
   * @param {!Array<!Object>} rows
   * @param {string} field
   * @param {boolean=} ascending
   * @return {!Array<!Object>}
   */
  sortByNumber: function (rows, field, ascending) {
    var factor = ascending ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      return (Utils.toNumber(a[field]) - Utils.toNumber(b[field])) * factor;
    });
  }
};
