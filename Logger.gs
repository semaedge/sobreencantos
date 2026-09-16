/**
 * Logger.gs
 * Log com niveis. Escreve sempre no console (Stackdriver) e, opcionalmente,
 * na aba Logs quando Config.LOG_TO_SHEET esta ativo.
 *
 * O nome AppLogger evita colisao com o objeto Logger nativo do Apps Script.
 */
var AppLogger = (function () {

  var LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

  /**
   * @param {string} level
   * @return {boolean} true se o nivel deve ser registrado.
   */
  function enabled_(level) {
    var threshold = LEVELS[Config.LOG_LEVEL] || LEVELS.INFO;
    return LEVELS[level] >= threshold;
  }

  /**
   * @param {string} level
   * @param {string} message
   * @param {Object=} context
   */
  function write_(level, message, context) {
    if (!enabled_(level)) return;

    var safeMessage = Utils.sanitize(message, 1000);
    var safeContext = context ? sanitizeContext_(context, [], 0) : null;
    var line = '[' + level + '] ' + safeMessage;
    if (level === 'ERROR') {
      console.error(line, safeContext || '');
    } else if (level === 'WARN') {
      console.warn(line, safeContext || '');
    } else {
      console.log(line, safeContext || '');
    }

    if (Config.LOG_TO_SHEET) appendToSheet_(level, safeMessage, safeContext);
  }

  /**
   * Remove segredos, limita profundidade e tolera referencias circulares.
   * @param {*} value
   * @param {!Array<*>} seen
   * @param {number} depth
   * @return {*}
   */
  function sanitizeContext_(value, seen, depth) {
    if (value === null || value === undefined) return null;
    if (depth > 4) return '[limite de profundidade]';
    if (typeof value === 'string') return Utils.sanitize(value, 1000);
    if (typeof value !== 'object') return value;
    if (seen.indexOf(value) !== -1) return '[referencia circular]';

    seen.push(value);
    var output;
    if (Array.isArray(value)) {
      output = value.slice(0, 50).map(function (item) {
        return sanitizeContext_(item, seen, depth + 1);
      });
    } else {
      output = {};
      Object.keys(value).slice(0, 50).forEach(function (key) {
        if (/password|senha|token|authorization|cookie|secret/i.test(key)) {
          output[key] = '[redigido]';
        } else {
          output[key] = sanitizeContext_(value[key], seen, depth + 1);
        }
      });
    }
    seen.pop();
    return output;
  }

  /**
   * Grava na aba Logs. Falhas aqui nunca interrompem a operacao em curso.
   * @param {string} level
   * @param {string} message
   * @param {Object=} context
   */
  function appendToSheet_(level, message, context) {
    try {
      var sheet = SheetManager.getSheet(Config.SHEETS.LOGS);
      var serialized = '';
      try {
        serialized = context ? JSON.stringify(context) : '';
      } catch (serializationError) {
        serialized = '{"erro":"contexto nao serializavel"}';
      }
      sheet.appendRow([
        Utils.nowIso(),
        level,
        safeCell_(message),
        safeCell_(serialized.substring(0, 5000))
      ]);
    } catch (err) {
      console.warn('Nao foi possivel gravar log na planilha: ' + (err && err.message));
    }
  }

  /**
   * Evita que texto controlado externamente vire formula na planilha.
   * @param {*} value
   * @return {string}
   */
  function safeCell_(value) {
    var text = String(value === undefined || value === null ? '' : value);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  }

  return {
    /** @param {string} message @param {Object=} context */
    debug: function (message, context) { write_('DEBUG', message, context); },
    /** @param {string} message @param {Object=} context */
    info: function (message, context) { write_('INFO', message, context); },
    /** @param {string} message @param {Object=} context */
    warn: function (message, context) { write_('WARN', message, context); },
    /** @param {string} message @param {Object=} context */
    error: function (message, context) { write_('ERROR', message, context); }
  };
})();
