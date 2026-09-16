/**
 * ScoreService.gs
 * Registro de pontuacoes das partidas.
 */
var ScoreService = {

  /** Limite defensivo: pontuacao acima disso indica cliente adulterado. */
  MAX_PLAUSIBLE_SCORE: 1000000,
  MAX_HISTORY_LIMIT: 100,
  MAX_DISTANCE_FACTOR: 1.25,

  /**
   * Registra a pontuacao de uma partida.
   * @param {string} userId
   * @param {!Object} result Campos: level, score, distance, coins.
   * @return {!Object} O registro gravado.
   */
  submitScore: function (userId, result) {
    var user = UserService.getById(userId);
    var payload = result || {};

    var level = GameConstants.getLevel(payload.level);
    if (!level) throw Errors.validation('Nivel inexistente: ' + payload.level);

    var score = ScoreService.validateScore_(payload.score, userId);

    var distance = ScoreService.requireFiniteNumber_(payload.distance, 'Distancia');
    var maxDistance = level.lengthMeters * ScoreService.MAX_DISTANCE_FACTOR;
    if (distance < 0 || distance > maxDistance) {
      AppLogger.warn('Tentativa de submeter distância inválida.', {
        userId: userId,
        distance: distance,
        maxDistance: maxDistance,
        levelId: level.id,
        severity: 'security'
      });
      throw Errors.validation('Distancia invalida.');
    }

    // CORREÇÃO P18: Moedas agora são DERIVADAS da distância no GameSession.endGame().
    // ScoreService recebe moedas já calculadas pelo servidor — não valida origem do cliente.
    var coins = ScoreService.requireFiniteNumber_(payload.coins, 'Moedas');
    if (Math.floor(coins) !== coins || coins < 0) {
      throw Errors.validation('Quantidade de moedas invalida.');
    }

    AppLogger.info('Pontuação registrada.', {
      userId: userId,
      levelId: level.id,
      score: score,
      distance: distance
    });

    return CrudService.create(Config.SHEETS.SCORES, {
      userId: user.id,
      username: user.username,
      level: level.id,
      score: score,
      distance: distance,
      coins: coins
    });
  },

  /**
   * Melhor pontuacao do usuario.
   * @param {string} userId
   * @param {number=} levelId Restringe a um nivel, se informado.
   * @return {number} 0 quando nao ha partidas.
   */
  getBestScore: function (userId, levelId) {
    var criteria = { userId: userId };
    if (levelId !== undefined) criteria.level = Utils.toInt(levelId);

    return CrudService.findBy(Config.SHEETS.SCORES, criteria)
        .reduce(function (best, row) {
          return Math.max(best, Utils.toInt(row.score));
        }, 0);
  },

  /**
   * Historico de partidas do usuario, da mais recente para a mais antiga.
   * @param {string} userId
   * @param {number=} limit
   * @return {!Array<!Object>}
   */
  getUserScores: function (userId, limit) {
    var scores = CrudService.findBy(Config.SHEETS.SCORES, { userId: userId })
        .sort(function (a, b) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    var requested = Utils.toInt(limit, 20);
    var safeLimit = Utils.clamp(requested, 1, ScoreService.MAX_HISTORY_LIMIT);
    return scores.slice(0, safeLimit);
  },

  /**
   * Estatisticas agregadas do usuario.
   * @param {string} userId
   * @return {!Object}
   */
  getStats: function (userId) {
    var scores = CrudService.findBy(Config.SHEETS.SCORES, { userId: userId });
    var totals = scores.reduce(function (acc, row) {
      acc.score += Utils.toInt(row.score);
      acc.distance += Utils.toNumber(row.distance);
      acc.coins += Utils.toInt(row.coins);
      acc.bestScore = Math.max(acc.bestScore, Utils.toInt(row.score));
      return acc;
    }, { score: 0, distance: 0, coins: 0, bestScore: 0 });

    return {
      gamesPlayed: scores.length,
      totalScore: totals.score,
      totalDistance: totals.distance,
      totalCoins: totals.coins,
      bestScore: totals.bestScore,
      averageScore: scores.length ? Math.round(totals.score / scores.length) : 0
    };
  },

  /**
   * Rejeita campos ausentes, texto parcial, NaN e infinito.
   * @param {*} value
   * @param {string} fieldName
   * @return {number}
   * @private
   */
  requireFiniteNumber_: function (value, fieldName) {
    if (Utils.isBlank(value) ||
        (typeof value !== 'number' && typeof value !== 'string')) {
      throw Errors.validation(fieldName + ' invalida.');
    }
    var number = Number(value);
    if (!isFinite(number)) throw Errors.validation(fieldName + ' invalida.');
    return number;
  },

  /**
   * Valida a pontuacao bruta antes de qualquer efeito persistente.
   * @param {*} value
   * @param {string=} userId
   * @return {number}
   * @private
   */
  validateScore_: function (value, userId) {
    var score = ScoreService.requireFiniteNumber_(value, 'Pontuacao');
    if (Math.floor(score) !== score || score < 0 ||
        score > ScoreService.MAX_PLAUSIBLE_SCORE) {
      AppLogger.warn('Tentativa de submeter pontuação implausível.', {
        userId: userId || null,
        score: score,
        maxPlausible: ScoreService.MAX_PLAUSIBLE_SCORE,
        severity: 'security'
      });
      throw Errors.validation('Pontuacao invalida.');
    }
    return score;
  }
};
