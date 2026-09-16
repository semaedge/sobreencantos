/**
 * LeaderboardService.gs
 * Ranking global. Guarda o resultado em cache curto porque a leitura varre a
 * aba inteira de pontuacoes.
 *
 * A invalidacao usa um contador de versao na chave do cache: em vez de tentar
 * apagar todas as combinacoes de limite e nivel, basta incrementar a versao e
 * as entradas antigas ficam orfas e expiram sozinhas.
 */
var LeaderboardService = {

  CACHE_KEY_PREFIX: 'leaderboard:',
  CACHE_TTL_SECONDS: 60,
  VERSION_PROPERTY: 'LEADERBOARD_VERSION',

  /**
   * Melhores pontuacoes, uma entrada por jogador.
   * @param {number=} limit Padrao 10, maximo 100.
   * @param {number=} levelId Restringe a um nivel, se informado.
  * @return {!Array<!Object>} Entradas com rank, username, score e level.
  */
  getTopScores: function (limit, levelId) {
    var max = LeaderboardService.normalizeLimit_(limit);
    var target = LeaderboardService.normalizeLevelId_(levelId);
    var cacheKey = LeaderboardService.cacheKey_(max, target);
    var cache = CacheService.getScriptCache();

    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        AppLogger.warn('Cache de ranking invalido, recalculando.');
      }
    }

    var scores = CrudService.findAll(Config.SHEETS.SCORES);
    if (target !== null) {
      scores = scores.filter(function (row) { return Utils.toInt(row.level) === target; });
    }

    var bestByUser = {};
    scores.forEach(function (row) {
      var key = Utils.str(row.userId) || Utils.str(row.username);
      var score = Utils.toInt(row.score);
      if (!bestByUser[key] || score > bestByUser[key].score) {
        bestByUser[key] = {
          username: Utils.str(row.username),
          score: score,
          level: Utils.toInt(row.level),
          achievedAt: row.createdAt
        };
      }
    });

    var ranking = Object.keys(bestByUser)
        .map(function (key) { return bestByUser[key]; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, max)
        .map(function (entry, index) {
          entry.rank = index + 1;
          return entry;
        });

    cache.put(cacheKey, JSON.stringify(ranking), LeaderboardService.CACHE_TTL_SECONDS);
    return ranking;
  },

  /**
   * Posicao do usuario no ranking global.
   * @param {string} userId
   * @return {{rank: ?number, score: number, totalPlayers: number}}
   */
  getUserRank: function (userId) {
    var bestByUser = {};
    CrudService.findAll(Config.SHEETS.SCORES).forEach(function (row) {
      var key = Utils.str(row.userId);
      var score = Utils.toInt(row.score);
      if (!bestByUser[key] || score > bestByUser[key]) bestByUser[key] = score;
    });

    var ordered = Object.keys(bestByUser).sort(function (a, b) {
      return bestByUser[b] - bestByUser[a];
    });
    var position = ordered.indexOf(Utils.str(userId));

    return {
      rank: position === -1 ? null : position + 1,
      score: bestByUser[Utils.str(userId)] || 0,
      totalPlayers: ordered.length
    };
  },

  /**
   * Vizinhanca do jogador: ate 2 colegas com pontuacao maior ou igual e ate 2
   * com pontuacao menor ou igual. Nao usa cache porque a janela depende de quem
   * pergunta — cachear por usuario multiplicaria as chaves sem ganho real.
   *
   * @param {string} userId
   * @return {{posicao: number, total: number, linhas: !Array<!Object>}}
   */
  getVizinhanca: function (userId) {
    var bestByUser = {};
    CrudService.findAll(Config.SHEETS.SCORES).forEach(function (row) {
      var key = Utils.str(row.userId) || Utils.str(row.username);
      var score = Utils.toInt(row.score);
      if (!bestByUser[key] || score > bestByUser[key].pontuacao) {
        bestByUser[key] = {
          id: key,
          nome: Utils.str(row.username),
          pontuacao: score
        };
      }
    });

    return rankingVizinhanca(
        Object.keys(bestByUser).map(function (key) { return bestByUser[key]; }),
        Utils.str(userId));
  },

  /** Invalida o ranking em cache incrementando a versao. */
  invalidateCache: function () {
    var props = PropertiesService.getScriptProperties();
    var next = Utils.toInt(props.getProperty(LeaderboardService.VERSION_PROPERTY)) + 1;
    props.setProperty(LeaderboardService.VERSION_PROPERTY, String(next));
  },

  /**
   * @param {number} limit
   * @param {number|undefined} levelId
   * @return {string}
   * @private
   */
  cacheKey_: function (limit, levelId) {
    var version = Utils.toInt(
        PropertiesService.getScriptProperties()
            .getProperty(LeaderboardService.VERSION_PROPERTY));
    var scope = (levelId === undefined || levelId === null) ? 'all' : Utils.toInt(levelId);
    return LeaderboardService.CACHE_KEY_PREFIX + version + ':' + limit + ':' + scope;
  },

  /**
   * Normaliza o limite da consulta pública do ranking.
   * @param {*} value
   * @return {number}
   * @private
   */
  normalizeLimit_: function (value) {
    if (value === undefined || value === null ||
        (typeof value === 'string' && value.trim() === '')) {
      return 10;
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw Errors.validation('Limite do ranking invalido.');
    }
    var number = Number(value);
    if (!isFinite(number) || Math.floor(number) !== number) {
      throw Errors.validation('Limite do ranking invalido.');
    }
    return Utils.clamp(number, 1, 100);
  },

  /**
   * Normaliza o filtro de nivel sem aceitar coercao parcial.
   * @param {*} value
   * @return {?number}
   * @private
   */
  normalizeLevelId_: function (value) {
    if (value === undefined || value === null ||
        (typeof value === 'string' && value.trim() === '')) {
      return null;
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw Errors.validation('Nivel do ranking invalido.');
    }
    var number = Number(value);
    if (!isFinite(number) || Math.floor(number) !== number || number < 1) {
      throw Errors.validation('Nivel do ranking invalido.');
    }
    return number;
  }
};
