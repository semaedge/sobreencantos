/**
 * ProgressService.gs
 * Progresso persistente do jogador: nivel atual, nivel maximo alcancado,
 * distancia total e um blob de estado livre (`state`) para o jogo salvo.
 */
var ProgressService = {

  CLIENT_WRITABLE_FIELDS: ['currentLevel', 'state'],
  CLIENT_STATE_FIELDS: ['checkpoint'],

  /**
   * Cria a linha de progresso inicial de um usuario.
   * @param {string} userId
   * @return {!Object}
   */
  initProgress: function (userId) {
    return CrudService.create(Config.SHEETS.PROGRESS, {
      userId: userId,
      currentLevel: 1,
      maxLevelReached: 1,
      totalDistance: 0,
      state: { checkpoint: null, unlockedPowerUps: [], levelsCompleted: [] }
    });
  },

  /**
   * Progresso do usuario, criado sob demanda se ainda nao existir.
   * @param {string} userId
   * @return {!Object}
   */
  getProgress: function (userId) {
    var progress = CrudService.findOne(Config.SHEETS.PROGRESS, { userId: userId });
    if (!progress) progress = ProgressService.initProgress(userId);

    return {
      currentLevel: Utils.toInt(progress.currentLevel, 1),
      maxLevelReached: Utils.toInt(progress.maxLevelReached, 1),
      totalDistance: Utils.toNumber(progress.totalDistance),
      state: progress.state || {},
      updatedAt: progress.updatedAt
    };
  },

  /**
   * Grava o progresso do usuario da sessao.
   * @param {string} token
   * O cliente pode selecionar um nivel ja liberado e salvar somente o
   * checkpoint. Distancia total, niveis concluidos e power-ups sao
   * exclusivamente atualizados pelas regras do servidor.
   * @param {!Object} data Campos aceitos: currentLevel, state.checkpoint.
   * @return {!Object} Progresso atualizado.
   */
  saveProgress: function (token, data) {
    var session = SessionManager.requireSession(token);
    var payload = data || {};
    ProgressService.requireOnlyFields_(
        payload, ProgressService.CLIENT_WRITABLE_FIELDS, 'progresso');
    var current = ProgressService.getProgress(session.userId);
    var patch = {};

    if (payload.currentLevel !== undefined) {
      var level = ProgressService.requireInteger_(payload.currentLevel, 'Nivel atual');
      if (level < 1 || level > GameConstants.getMaxLevelId()) {
        throw Errors.validation('Nivel atual invalido.');
      }
      if (level > current.maxLevelReached) {
        throw Errors.forbidden('Nivel ainda nao desbloqueado.');
      }
      patch.currentLevel = level;
    }

    if (payload.state !== undefined) {
      ProgressService.requireOnlyFields_(
          payload.state, ProgressService.CLIENT_STATE_FIELDS, 'estado');
      patch.state = ProgressService.mergeState_(current.state, {
        checkpoint: ProgressService.validateCheckpoint_(
            payload.state.checkpoint, current.maxLevelReached)
      });
    }

    if (Object.keys(patch).length === 0) {
      throw Errors.validation('Nada para salvar.');
    }

    ProgressService.updateRow_(session.userId, patch);
    return ProgressService.getProgress(session.userId);
  },

  /**
   * Soma distancia percorrida ao total do jogador. Uso interno (fim de
   * partida), sem token: quem chama ja validou a sessao.
   * @param {string} userId
   * @param {number} distance
   * @return {!Object} Progresso atualizado.
   */
  addDistance: function (userId, distance) {
    var meters = Math.max(0, Utils.toNumber(distance));
    if (meters > 0) {
      var current = ProgressService.getProgress(userId);
      ProgressService.updateRow_(userId, {
        totalDistance: current.totalDistance + meters
      });
    }
    return ProgressService.getProgress(userId);
  },

  /**
   * Marca um nivel como concluido e libera o seguinte.
   * @param {string} userId
   * @param {number} levelId
   * @param {number=} distance Distancia percorrida na conclusao.
   * @return {!Object} Progresso atualizado.
   */
  completeLevel: function (userId, levelId, distance) {
    var level = GameConstants.getLevel(levelId);
    if (!level) throw Errors.validation('Nivel inexistente: ' + levelId);

    var current = ProgressService.getProgress(userId);
    var completed = (current.state.levelsCompleted || []).slice();
    if (completed.indexOf(level.id) === -1) completed.push(level.id);

    var nextLevel = Math.min(level.id + 1, GameConstants.getMaxLevelId());
    var state = ProgressService.mergeState_(current.state, { levelsCompleted: completed });
    var meters = Math.max(0, Utils.toNumber(distance));

    ProgressService.updateRow_(userId, {
      maxLevelReached: Math.max(current.maxLevelReached, nextLevel),
      // Rejogar uma fase antiga nunca deve fazer a selecao atual regredir.
      currentLevel: Math.max(current.currentLevel, nextLevel),
      totalDistance: current.totalDistance + meters,
      state: state
    });

    AppLogger.info('Nivel concluido.', { userId: userId, levelId: level.id });
    return ProgressService.getProgress(userId);
  },

  /**
   * Niveis com a marcacao de bloqueado/concluido para a tela de selecao.
   * A montagem em si vive em GameDataService, que e a fonte unica desse formato.
   * @param {string} token
   * @return {!Array<!Object>}
   */
  getLevelSelection: function (token) {
    var session = SessionManager.requireSession(token);
    return GameDataService.niveisDoJogador(session.userId);
  },

  /**
   * Aplica o patch na linha de progresso, criando-a se preciso.
   * @param {string} userId
   * @param {!Object} patch
   * @private
   */
  updateRow_: function (userId, patch) {
    CrudService.upsert(Config.SHEETS.PROGRESS, { userId: userId }, patch);
  },

  /**
   * Une o estado salvo com o novo, campo a campo.
   * @param {!Object} currentState
   * @param {!Object} incoming
   * @return {!Object}
   * @private
   */
  mergeState_: function (currentState, incoming) {
    var merged = Utils.clone(currentState) || {};
    Object.keys(incoming || {}).forEach(function (key) {
      merged[key] = incoming[key];
    });
    return merged;
  },

  /**
   * @param {*} value
   * @param {number} maxLevelReached
   * @return {?Object}
   * @private
   */
  validateCheckpoint_: function (value, maxLevelReached) {
    if (value === null) return null;
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') {
      throw Errors.validation('Checkpoint invalido.');
    }
    ProgressService.requireOnlyFields_(value, ['levelId', 'distance'], 'checkpoint');
    var levelId = ProgressService.requireInteger_(value.levelId, 'Nivel do checkpoint');
    var level = GameConstants.getLevel(levelId);
    var distance = ProgressService.requireFiniteNumber_(
        value.distance, 'Distancia do checkpoint');
    if (!level || levelId > maxLevelReached) {
      throw Errors.forbidden('Checkpoint pertence a um nivel nao desbloqueado.');
    }
    if (!isFinite(distance) || distance < 0 || distance > level.lengthMeters) {
      throw Errors.validation('Distancia de checkpoint invalida.');
    }
    return { levelId: levelId, distance: Math.round(distance) };
  },

  /**
   * @param {*} value
   * @param {!Array<string>} allowed
   * @param {string} label
   * @private
   */
  requireOnlyFields_: function (value, allowed, label) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') {
      throw Errors.validation('Dados de ' + label + ' invalidos.');
    }
    var unknown = Object.keys(value).filter(function (key) {
      return allowed.indexOf(key) === -1;
    });
    if (unknown.length) {
      throw Errors.validation('Campo de ' + label + ' controlado pelo servidor: ' +
                              unknown[0] + '.');
    }
  },

  /** @param {*} value @param {string} label @return {number} @private */
  requireFiniteNumber_: function (value, label) {
    if (Utils.isBlank(value) ||
        (typeof value !== 'number' && typeof value !== 'string')) {
      throw Errors.validation(label + ' invalida.');
    }
    var number = Number(value);
    if (!isFinite(number)) throw Errors.validation(label + ' invalida.');
    return number;
  },

  /** @param {*} value @param {string} label @return {number} @private */
  requireInteger_: function (value, label) {
    var number = ProgressService.requireFiniteNumber_(value, label);
    if (Math.floor(number) !== number) {
      throw Errors.validation(label + ' invalido.');
    }
    return number;
  }
};
