/**
 * SettingsService.gs
 * Configuracoes por usuario (audio, dificuldade, controles, idioma).
 * Valores desconhecidos sao rejeitados para nao contaminar a planilha.
 */
var SettingsService = {

  ALLOWED_DIFFICULTIES: ['easy', 'normal', 'hard'],
  ALLOWED_CONTROLS: ['touch', 'keyboard'],
  ALLOWED_LANGUAGES: ['pt-BR', 'en-US'],
  ALLOWED_FIELDS: [
    'musicVolume', 'sfxVolume', 'difficulty', 'controls', 'language', 'showTutorial'
  ],

  /**
   * Configuracoes do usuario, com os padroes preenchidos.
   * @param {string} userId
   * @return {!Object}
   */
  getSettings: function (userId) {
    var row = CrudService.findOne(Config.SHEETS.SETTINGS, { userId: userId });
    var stored = (row && row.settings) || {};
    var merged = Utils.clone(GameConstants.DEFAULT_SETTINGS);
    Object.keys(merged).forEach(function (key) {
      if (stored[key] !== undefined) {
        try {
          SettingsService.applyField_(merged, key, stored[key]);
        } catch (err) {
          AppLogger.warn('Configuracao persistida invalida ignorada.', {
            userId: userId, field: key
          });
        }
      }
    });
    return merged;
  },

  /**
   * Grava as configuracoes do usuario da sessao.
   * @param {string} token
   * @param {!Object} changes
   * @return {!Object} Configuracoes efetivas apos a gravacao.
   */
  saveSettings: function (token, changes) {
    var session = SessionManager.requireSession(token);
    var current = SettingsService.getSettings(session.userId);
    var incoming = changes || {};
    SettingsService.requireOnlyFields_(incoming);
    var next = Utils.clone(current);

    Object.keys(incoming).forEach(function (key) {
      SettingsService.applyField_(next, key, incoming[key]);
    });

    CrudService.upsert(Config.SHEETS.SETTINGS,
                       { userId: session.userId },
                       { settings: next });
    return next;
  },

  /**
   * Restaura os padroes.
   * @param {string} token
   * @return {!Object}
   */
  resetSettings: function (token) {
    var session = SessionManager.requireSession(token);
    var defaults = Utils.clone(GameConstants.DEFAULT_SETTINGS);
    CrudService.upsert(Config.SHEETS.SETTINGS,
                       { userId: session.userId },
                       { settings: defaults });
    return defaults;
  },

  /**
   * @param {*} value
   * @param {!Array<string>} allowed
   * @param {string} fieldName
   * @return {string}
   * @private
   */
  requireOneOf_: function (value, allowed, fieldName) {
    if (typeof value !== 'string') {
      throw Errors.validation('Valor invalido para ' + fieldName + '.');
    }
    var candidate = Utils.str(value);
    if (allowed.indexOf(candidate) === -1) {
      throw Errors.validation('Valor invalido para ' + fieldName + '. Aceitos: ' +
                              allowed.join(', ') + '.');
    }
    return candidate;
  },

  /**
   * @param {!Object} target
   * @param {string} key
   * @param {*} value
   * @private
   */
  applyField_: function (target, key, value) {
    if (key === 'musicVolume' || key === 'sfxVolume') {
      if (Utils.isBlank(value) ||
          (typeof value !== 'number' && typeof value !== 'string')) {
        throw Errors.validation('Volume invalido.');
      }
      var volume = Number(value);
      if (!isFinite(volume)) throw Errors.validation('Volume invalido.');
      target[key] = Utils.clamp(volume, 0, 1);
      return;
    }
    if (key === 'difficulty') {
      target[key] = SettingsService.requireOneOf_(
          value, SettingsService.ALLOWED_DIFFICULTIES, 'dificuldade');
      return;
    }
    if (key === 'controls') {
      target[key] = SettingsService.requireOneOf_(
          value, SettingsService.ALLOWED_CONTROLS, 'controles');
      return;
    }
    if (key === 'language') {
      target[key] = SettingsService.requireOneOf_(
          value, SettingsService.ALLOWED_LANGUAGES, 'idioma');
      return;
    }
    if (key === 'showTutorial') {
      if (typeof value !== 'boolean') {
        throw Errors.validation('O indicador de tutorial deve ser booleano.');
      }
      target[key] = value;
    }
  },

  /**
   * @param {*} incoming
   * @private
   */
  requireOnlyFields_: function (incoming) {
    if (!incoming || Object.prototype.toString.call(incoming) !== '[object Object]') {
      throw Errors.validation('Configuracoes invalidas.');
    }
    var keys = Object.keys(incoming);
    if (!keys.length) throw Errors.validation('Nenhuma configuracao foi informada.');
    var unknown = keys.filter(function (key) {
      return SettingsService.ALLOWED_FIELDS.indexOf(key) === -1;
    });
    if (unknown.length) {
      throw Errors.validation('Configuracao desconhecida: ' + unknown[0] + '.');
    }
  }
};
