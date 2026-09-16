/**
 * GameSession.gs
 * Ciclo de vida de uma partida: startGame() abre a sessao de jogo e devolve
 * tudo que o frontend precisa para montar o nivel; endGame() fecha a partida,
 * grava pontuacao e atualiza progresso.
 *
 * A sessao de jogo fica no cache, indexada pelo token de autenticacao, para
 * que endGame() valide que a partida realmente comecou pelo backend.
 */
var GameSession = {

  CACHE_PREFIX: 'game:',
  CACHE_TTL_SECONDS: 2 * 60 * 60,

  /**
   * Inicia uma partida no nivel pedido.
   * @param {string} token
   * @param {number} levelId
   * @return {!Object} Dados de inicializacao do nivel.
   */
  startGame: function (token, levelId) {
    var session = SessionManager.requireSession(token);
    var level = GameConstants.getLevel(levelId);
    if (!level) throw Errors.validation('Nivel inexistente: ' + levelId);

    var progress = ProgressService.getProgress(session.userId);
    if (level.id > progress.maxLevelReached) {
      throw Errors.forbidden('Nivel ainda nao desbloqueado.');
    }

    var settings = SettingsService.getSettings(session.userId);
    var gameSession = {
      gameId: Utils.uuid(),
      userId: session.userId,
      levelId: level.id,
      startedAt: Utils.nowIso(),
      difficulty: settings.difficulty
    };

    CacheService.getScriptCache().put(GameSession.cacheKey_(token),
                                     JSON.stringify(gameSession),
                                     GameSession.CACHE_TTL_SECONDS);

    // Somente o que e desta partida. As constantes de jogo (fisica, jogador,
    // pontuacao, tile) o cliente ja recebeu em api_bootstrap e nao mudam entre
    // partidas: reenviar aqui criava duas copias e o risco de o cliente ler
    // metade de cada uma.
    return {
      gameId: gameSession.gameId,
      level: level,
      difficulty: GameConstants.getDifficulty(settings.difficulty),
      difficultyName: settings.difficulty,
      bestScore: ScoreService.getBestScore(session.userId, level.id)
    };
  },

  /**
   * Encerra a partida em andamento.
   * @param {string} token
   * @param {!Object} result Campos de jogo e evidência pedagógica `learning`.
   * @return {!Object} Resumo do fim de partida.
   */
  endGame: function (token, result) {
    var session = SessionManager.requireSession(token);
    var payload = result || {};

    // O gameId é a chave de idempotência da submissão. O lock cobre desde a
    // leitura da partida ativa até sua remoção do cache: uma segunda chamada
    // espera a primeira terminar e então é rejeitada sem duplicar pontuação,
    // moedas, progresso ou diário pedagógico.
    return SheetManager.withLock(function () {
    var gameSession = GameSession.getActive_(token);
    GameSession.requireMatchingGame_(gameSession, payload.gameId);

    var difficulty = GameConstants.getDifficulty(gameSession.difficulty);
    var completed = payload.completed === true;
    var activeLevel = GameConstants.getLevel(gameSession.levelId);
    // Valida o caderno antes de qualquer escrita de score, saldo ou progresso.
    // Isso mantém a partida atômica: uma evidência incompleta não deixa efeitos
    // persistentes parciais para o frontend precisar desfazer.
    var learningValidation = LearningJournalService.validate(activeLevel, payload.learning, true);
    var learning = learningValidation.normalized;
    var reportedDistance = Number(payload.distance);
    if (completed && (!isFinite(reportedDistance) ||
        reportedDistance < activeLevel.lengthMeters)) {
      throw Errors.validation('A distancia informada nao conclui o nivel.');
    }
    var rawScore = ScoreService.validateScore_(payload.score, session.userId);
    var finalScore = Math.round(rawScore * difficulty.scoreMultiplier) +
                     (completed ? GameConstants.SCORING.LEVEL_COMPLETE_BONUS : 0);

    // O conjunto anterior precisa ser capturado antes de score/progresso;
    // lê-lo depois das escritas faria toda conquista parecer já desbloqueada.
    var previousProgress = ProgressService.getProgress(session.userId);
    var previousStats = ScoreService.getStats(session.userId);
    var previousAchievements = AchievementService.evaluate(
        previousProgress, previousStats);

    var previousBest = ScoreService.getBestScore(session.userId, gameSession.levelId);
    
    // CORREÇÃO P18: Moedas coletadas derivadas da distância percorrida no servidor.
    // O cliente NÃO pode enviar payload.coins — seria vulnerável a adulteração.
    // Fórmula canônica: 1 moeda a cada 10 metros percorridos (arredondado para baixo).
    var collectedCoins = Math.floor(reportedDistance / GameConstants.SCORING.POINTS_PER_COIN);
    
    var scoreRecord = ScoreService.submitScore(session.userId, {
      level: gameSession.levelId,
      score: finalScore,
      distance: payload.distance,
      coins: collectedCoins  // Derivado do servidor
    });

    var earnedCoins = collectedCoins +
                      (completed ? GameConstants.SCORING.COINS_PER_LEVEL_COMPLETE : 0);
    var coinBalance = earnedCoins > 0
        ? UserService.addCoins(session.userId, earnedCoins)
        : Utils.toInt(UserService.getById(session.userId).coins);

    var progress = completed
        ? ProgressService.completeLevel(
            session.userId, gameSession.levelId, payload.distance)
        : ProgressService.addDistance(session.userId, payload.distance);

    var journal = LearningJournalService.record(
        session.userId, gameSession, activeLevel, learning, payload, finalScore);

    // Avalia e notifica novas conquistas desbloqueadas
    var updatedProgress = ProgressService.getProgress(session.userId);
    var updatedStats = ScoreService.getStats(session.userId);
    var currentAchievements = AchievementService.evaluate(updatedProgress, updatedStats);
    
    var newlyUnlocked = currentAchievements.filter(function(id) {
      return previousAchievements.indexOf(id) === -1;
    });
    var achievementRewardCoins = AchievementService.rewardCoinsFor(newlyUnlocked);
    if (achievementRewardCoins > 0) {
      coinBalance = UserService.addCoins(session.userId, achievementRewardCoins);
    }

    LeaderboardService.invalidateCache();
    CacheService.getScriptCache().remove(GameSession.cacheKey_(token));

    AppLogger.info('Partida encerrada.', {
      userId: session.userId, levelId: gameSession.levelId,
      score: finalScore, completed: completed,
      newAchievements: newlyUnlocked.length,
      achievementRewardCoins: achievementRewardCoins
    });

    var profile = UserService.toPublicProfile(UserService.getById(session.userId));
    profile.bestScore = ScoreService.getBestScore(session.userId);
    profile.progress = progress;

    return {
      gameId: gameSession.gameId,
      score: finalScore,
      isNewBest: finalScore > previousBest,
      earnedCoins: earnedCoins,
      achievementRewardCoins: achievementRewardCoins,
      coinBalance: coinBalance,
      completed: completed,
      progress: progress,
      rank: LeaderboardService.getUserRank(session.userId),
      scoreId: scoreRecord.id,
      learningJournalId: journal.id,
      newAchievements: newlyUnlocked.map(function(id) {
        return AchievementService.CATALOG.filter(function(a) { return a.id === id; })[0];
      }),
      state: {
        profile: profile,
        progress: progress,
        levels: GameDataService.niveisDoJogador(session.userId),
        achievements: AchievementService.forPlayer(session.userId)
      }
    };
    });
  },

  /**
   * Descarta a partida em andamento sem gravar pontuacao.
   * @param {string} token
   * @param {string} gameId Identificador devolvido por startGame.
   * @return {boolean}
   */
  abandonGame: function (token, gameId) {
    // O mesmo lock de endGame serializa a decisão entre abandonar e encerrar.
    // Assim, nenhuma das operações trabalha com uma partida ativa obsoleta.
    return SheetManager.withLock(function () {
      SessionManager.requireSession(token);
      var gameSession = GameSession.getActive_(token);
      GameSession.requireMatchingGame_(gameSession, gameId);
      CacheService.getScriptCache().remove(GameSession.cacheKey_(token));
      return true;
    });
  },

  /**
   * Impede que uma resposta atrasada da partida anterior encerre ou abandone a
   * partida que a substituiu no cache.
   * @param {!Object} gameSession
   * @param {*} gameId
   * @private
   */
  requireMatchingGame_: function (gameSession, gameId) {
    var received = Utils.str(gameId);
    if (!received || received !== gameSession.gameId) {
      throw Errors.conflict('Esta partida não é mais a partida ativa.');
    }
  },

  /**
   * Partida em andamento, ou erro se nao houver.
   * @param {string} token
   * @return {!Object}
   * @private
   */
  getActive_: function (token) {
    var raw = CacheService.getScriptCache().get(GameSession.cacheKey_(token));
    if (!raw) throw Errors.validation('Nenhuma partida em andamento.');
    return JSON.parse(raw);
  },

  /**
   * @param {string} token
   * @return {string}
   * @private
   */
  cacheKey_: function (token) {
    return GameSession.CACHE_PREFIX + token;
  }
};
