/**
 * RemoteFunctions.gs
 * Unica fronteira entre frontend e backend. Todas as funcoes aqui sao
 * chamadas por google.script.run e devolvem o envelope de Errors:
 *
 *   google.script.run
 *     .withSuccessHandler(function (res) { if (res.ok) { ... } })
 *     .api_login(usuario, senha);
 *
 * Regras: nada de logica de negocio neste arquivo, apenas delegacao; toda
 * funcao passa por Errors.wrap, de forma que uma excecao nunca chega crua ao
 * cliente; funcoes que exigem usuario logado recebem o token como 1o argumento.
 */

// --- Abertura ----------------------------------------------------------------

/**
 * Tudo que o cliente precisa para abrir, em uma unica execucao.
 *
 * Antes a abertura custava quatro chamadas em sequencia - dados do jogo,
 * validacao de sessao, perfil e configuracoes - e no Apps Script cada chamada e
 * uma execucao completa do servidor. O usuario pagava a soma das latencias
 * olhando para a tela de carregamento.
 *
 * Aceita token ausente ou invalido: nesse caso devolve o que a tela de login
 * precisa e `sessao.valida` como false, sem erro. Sessao invalida na abertura e
 * situacao normal, nao excecao.
 *
 * @param {string=} token
 * @return {!Object}
 */
function api_bootstrap(token) {
  return Errors.wrap('api_bootstrap', function () {
    var sessao = SessionManager.getSession(token);

    var resposta = {
      contrato: ApiContract.paraCliente(),
      constantes: GameDataService.constantesDoJogo(),
      sessao: { valida: false, expiraEm: null, usuario: null },
      progresso: null,
      niveis: GameDataService.niveisPublicos(),
      configuracoes: null,
      inventario: null,
      conquistas: null
    };

    if (!sessao) return resposta;

    var user = CrudService.findById(Config.SHEETS.USERS, sessao.userId);
    if (!user) {
      // Sessao aponta para usuario removido: trata como sessao ausente.
      SessionManager.destroySession(token);
      return resposta;
    }

    var perfil = UserService.toPublicProfile(user);
    perfil.bestScore = ScoreService.getBestScore(user.id);

    resposta.sessao = {
      valida: true,
      expiraEm: sessao.expiresAt,
      usuario: perfil
    };
    resposta.progresso = ProgressService.getProgress(user.id);
    resposta.niveis = GameDataService.niveisDoJogador(user.id);
    resposta.configuracoes = SettingsService.getSettings(user.id);
    resposta.inventario = InventoryService.get(user.id);
    resposta.conquistas = AchievementService.forPlayer(user.id);

    return resposta;
  });
}

// --- Autenticacao ------------------------------------------------------------

/**
 * @param {string} username
 * @param {string} password
 * @param {string=} email
 * @return {!Object}
 */
function api_register(username, password, email) {
  return Errors.wrap('api_register', function () {
    return AuthService.register(username, password, email);
  });
}

/**
 * @param {string} username
 * @param {string} password
 * @return {!Object}
 */
function api_login(username, password) {
  return Errors.wrap('api_login', function () {
    return AuthService.login(username, password);
  });
}

/**
 * @param {string} token
 * @return {!Object}
 */
function api_logout(token) {
  return Errors.wrap('api_logout', function () {
    return AuthService.logout(token);
  });
}

/**
 * @param {string} token
 * @return {!Object} Envelope com { valid: boolean }.
 */
function api_validateSession(token) {
  return Errors.wrap('api_validateSession', function () {
    return { valid: SessionManager.getSession(token) !== null };
  });
}

/**
 * @param {string} token
 * @param {string} currentPassword
 * @param {string} newPassword
 * @return {!Object}
 */
function api_changePassword(token, currentPassword, newPassword) {
  return Errors.wrap('api_changePassword', function () {
    return AuthService.changePassword(token, currentPassword, newPassword);
  });
}

// --- Usuario ----------------------------------------------------------------

/**
 * @param {string} token
 * @return {!Object}
 */
function api_getProfile(token) {
  return Errors.wrap('api_getProfile', function () {
    return UserService.getProfile(token);
  });
}

/**
 * @param {string} token
 * @param {!Object} changes
 * @return {!Object}
 */
function api_updateProfile(token, changes) {
  return Errors.wrap('api_updateProfile', function () {
    return UserService.updateProfile(token, changes);
  });
}

// --- Dados estaticos de jogo -------------------------------------------------

/**
 * Constantes de jogo para o frontend. Nao exige login: sao dados publicos.
 * @return {!Object}
 */
function api_getGameData() {
  return Errors.wrap('api_getGameData', function () {
    return GameDataService.constantesDoJogo();
  });
}

/**
 * @param {string} token
 * @return {!Object}
 */
function api_getLevelSelection(token) {
  return Errors.wrap('api_getLevelSelection', function () {
    return ProgressService.getLevelSelection(token);
  });
}

// --- Partida ----------------------------------------------------------------

/**
 * @param {string} token
 * @param {number} levelId
 * @return {!Object}
 */
function api_startGame(token, levelId) {
  return Errors.wrap('api_startGame', function () {
    return GameSession.startGame(token, levelId);
  });
}

/**
 * @param {string} token
 * @param {!Object} result Campos de jogo e `learning` com hipótese, relação,
 * mecanismo, evidência e revisão.
 * @return {!Object}
 */
function api_endGame(token, result) {
  return Errors.wrap('api_endGame', function () {
    return GameSession.endGame(token, result);
  });
}

/**
 * @param {string} token
 * @param {string} gameId Identificador devolvido por api_startGame.
 * @return {!Object}
 */
function api_abandonGame(token, gameId) {
  return Errors.wrap('api_abandonGame', function () {
    return GameSession.abandonGame(token, gameId);
  });
}

// --- Progresso --------------------------------------------------------------

/**
 * @param {string} token
 * @return {!Object}
 */
function api_getProgress(token) {
  return Errors.wrap('api_getProgress', function () {
    var session = SessionManager.requireSession(token);
    return ProgressService.getProgress(session.userId);
  });
}

/**
 * @param {string} token
 * @param {!Object} data Campos: currentLevel, totalDistance, state.
 * @return {!Object}
 */
function api_saveProgress(token, data) {
  return Errors.wrap('api_saveProgress', function () {
    return ProgressService.saveProgress(token, data);
  });
}

// --- Pontuacao e ranking ----------------------------------------------------

/**
 * @param {number=} limit
 * @param {number=} levelId
 * @return {!Object}
 */
function api_getLeaderboard(limit, levelId) {
  return Errors.wrap('api_getLeaderboard', function () {
    return LeaderboardService.getTopScores(limit, levelId);
  });
}

/**
 * Vizinhanca do jogador da sessao no ranking global.
 * @param {string} token
 * @return {!Object}
 */
function api_getRankingVizinhanca(token) {
  return Errors.wrap('api_getRankingVizinhanca', function () {
    var session = SessionManager.requireSession(token);
    return LeaderboardService.getVizinhanca(session.userId);
  });
}

/**
 * @param {string} token
 * @return {!Object}
 */
function api_getMyStats(token) {
  return Errors.wrap('api_getMyStats', function () {
    var session = SessionManager.requireSession(token);
    var stats = ScoreService.getStats(session.userId);
    stats.rank = LeaderboardService.getUserRank(session.userId);
    stats.recentGames = ScoreService.getUserScores(session.userId, 10);
    return stats;
  });
}

// --- Configuracoes ----------------------------------------------------------

/**
 * @param {string} token
 * @return {!Object}
 */
function api_getSettings(token) {
  return Errors.wrap('api_getSettings', function () {
    var session = SessionManager.requireSession(token);
    return SettingsService.getSettings(session.userId);
  });
}

/**
 * @param {string} token
 * @param {!Object} changes
 * @return {!Object}
 */
function api_saveSettings(token, changes) {
  return Errors.wrap('api_saveSettings', function () {
    return SettingsService.saveSettings(token, changes);
  });
}

// --- Inventario -------------------------------------------------------------

/**
 * Retorna o inventario do jogador com quantidades de cada item.
 * @param {string} token
 * @return {!Object}
 */
function api_getInventory(token) {
  return Errors.wrap('api_getInventory', function () {
    var session = SessionManager.requireSession(token);
    return InventoryService.get(session.userId);
  });
}

/**
 * Usa um item do inventario durante o jogo.
 * @param {string} token
 * @param {string} itemId
 * @param {number=} quantity
 * @return {!Object}
 */
function api_useItem(token, itemId, quantity) {
  return Errors.wrap('api_useItem', function () {
    var session = SessionManager.requireSession(token);
    var amount = quantity === undefined ? 1 : quantity;
    return InventoryService.consume(session.userId, itemId, amount);
  });
}

/**
 * Compra um item usando moedas do jogador.
 * @param {string} token
 * @param {string} itemId
 * @param {number=} quantity
 * @return {!Object}
 */
function api_buyItem(token, itemId, quantity) {
  return Errors.wrap('api_buyItem', function () {
    var session = SessionManager.requireSession(token);
    var amount = quantity === undefined ? 1 : quantity;
    return ShopService.purchase(session.userId, itemId, amount);
  });
}

// --- Conquistas -------------------------------------------------------------

/**
 * Retorna todas as conquistas do jogador com status de desbloqueio.
 * @param {string} token
 * @return {!Object}
 */
function api_getAchievements(token) {
  return Errors.wrap('api_getAchievements', function () {
    var session = SessionManager.requireSession(token);
    return AchievementService.forPlayer(session.userId);
  });
}

// --- Evidencia Pedagogica ---------------------------------------------------

/**
 * Salva rascunho de evidência pedagógica.
 * @param {string} token
 * @param {number} levelId
 * @param {!Object} draft
 * @return {!Object}
 */
function api_saveLearningDraft(token, levelId, draft) {
  return Errors.wrap('api_saveLearningDraft', function () {
    var session = SessionManager.requireSession(token);
    return LearningJournalService.saveDraft(session.userId, levelId, draft);
  });
}

/**
 * Recupera rascunho salvo de evidência pedagógica.
 * @param {string} token
 * @param {number} levelId
 * @return {!Object}
 */
function api_getLearningDraft(token, levelId) {
  return Errors.wrap('api_getLearningDraft', function () {
    var session = SessionManager.requireSession(token);
    return LearningJournalService.getDraft(session.userId, levelId);
  });
}

/**
 * Histórico de aprendizagem do estudante.
 * @param {string} token
 * @param {number=} limit
 * @return {!Object}
 */
function api_getLearningHistory(token, limit) {
  return Errors.wrap('api_getLearningHistory', function () {
    var session = SessionManager.requireSession(token);
    return LearningJournalService.getHistory(session.userId, limit);
  });
}

// --- Experiencia Narrativa --------------------------------------------------

/**
 * Retorna dados de um capítulo do Experience Director.
 * @param {string} token
 * @param {string} chapterId
 * @param {number=} schoolYear
 * @return {!Object}
 */
function api_getExperienceChapter(token, chapterId, schoolYear) {
  return Errors.wrap('api_getExperienceChapter', function () {
    SessionManager.requireSession(token);
    if (typeof chapterId !== 'string' || Utils.isBlank(chapterId)) {
      throw Errors.validation('Capitulo invalido.');
    }
    var requestedChapter = EXPERIENCE_GAME_.chapters.filter(function (chapter) {
      return chapter.id === chapterId.trim();
    })[0];
    if (!requestedChapter) throw Errors.validation('Capitulo nao reconhecido.');
    return getExperienceChapter(requestedChapter.id, schoolYear);
  });
}

/**
 * Processa uma decisão narrativa do jogador.
 * @param {string} token
 * @param {!Object} state Estado atual do jogo narrativo
 * @param {string} chapterId
 * @param {string} decisionId
 * @param {string=} evidence
 * @return {!Object}
 */
function api_makeExperienceDecision(token, state, chapterId, decisionId, evidence) {
  return Errors.wrap('api_makeExperienceDecision', function () {
    // Leitura, validacao e escrita precisam usar a mesma fotografia do
    // progresso. Sem este lock, duas decisoes simultaneas poderiam ler o mesmo
    // capitulo e uma sobrescrever a evolucao gravada pela outra.
    return SheetManager.withLock(function () {
      var session = SessionManager.requireSession(token);
      if (typeof chapterId !== 'string' || Utils.isBlank(chapterId)) {
        throw Errors.validation('Capitulo invalido.');
      }
      if (typeof decisionId !== 'string' || Utils.isBlank(decisionId)) {
        throw Errors.validation('Escolha invalida.');
      }
      if (evidence !== undefined && evidence !== null &&
          typeof evidence !== 'string') {
        throw Errors.validation('Evidencia invalida.');
      }
      var progress = ProgressService.getProgress(session.userId);
      var progressState = Utils.clone(progress.state) || {};
      var storedState = progressState.experienceState || null;
      var currentChapter = storedState
          ? Utils.toInt(storedState.chapter, 1)
          : 1;
      var requestedChapter = EXPERIENCE_GAME_.chapters.filter(function (chapter) {
        return chapter.id === chapterId.trim();
      })[0];
      if (!requestedChapter) {
        throw Errors.validation('Capitulo nao reconhecido.');
      }
      if (requestedChapter.order !== currentChapter) {
        throw Errors.conflict('Este nao e o capitulo atual da experiencia.');
      }

      // O estado recebido pelo cliente e apenas informativo. A progressao usa
      // exclusivamente o ultimo estado persistido, evitando saltos e inflacao
      // de atributos narrativos por manipulacao da requisicao.
      var result = resolveExperienceDecision(
          storedState, requestedChapter.id, decisionId.trim(), evidence);

      // Persiste progresso narrativo no estado do usuário
      if (result.success) {
        progressState.experienceState = result.nextState;
        progressState.experienceChapter = result.nextState.chapter;
        ProgressService.updateRow_(session.userId, { state: progressState });

        AppLogger.info('Decisão narrativa registrada.', {
          userId: session.userId,
          chapterId: chapterId,
          decisionId: decisionId
        });
      }

      return result;
    });
  });
}

/**
 * Workflow básico da experiência narrativa.
 * @param {string} token
 * @param {number=} schoolYear
 * @return {!Object}
 */
function api_getExperienceWorkflow(token, schoolYear) {
  return Errors.wrap('api_getExperienceWorkflow', function () {
    var session = SessionManager.requireSession(token);
    var progress = ProgressService.getProgress(session.userId);
    var workflow = getExperienceBasicWorkflow(schoolYear);
    
    // Restaura estado salvo se existir
    if (progress.state && progress.state.experienceState) {
      workflow.data.state = progress.state.experienceState;
      workflow.data.chapter = progress.state.experienceChapter || 1;
    }
    
    return workflow;
  });
}

/**
 * Desfecho final da narrativa baseado no estado acumulado.
 * @param {string} token
 * @return {!Object}
 */
function api_getExperienceEndgame(token) {
  return Errors.wrap('api_getExperienceEndgame', function () {
    var session = SessionManager.requireSession(token);
    var progress = ProgressService.getProgress(session.userId);
    var state = (progress.state || {}).experienceState || null;
    return getExperienceEndgame(state);
  });
}

// --- Administracao ----------------------------------------------------------

/**
 * Resumo para o painel administrativo. Exige role 'admin'.
 * @param {string} token
 * @return {!Object}
 */
function api_adminGetDashboard(token) {
  return Errors.wrap('api_adminGetDashboard', function () {
    SessionManager.requireAdmin(token);
    return {
      totalUsers: CrudService.count(Config.SHEETS.USERS),
      totalGames: CrudService.count(Config.SHEETS.SCORES),
      topScores: LeaderboardService.getTopScores(10),
      generatedAt: Utils.nowIso()
    };
  });
}
