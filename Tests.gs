/**
 * Tests.gs
 * Testes de fumaca do backend. Rode runAllTests() no editor do Apps Script
 * depois de setup(); o resultado sai no log de execucao.
 *
 * Os testes criam um usuario temporario com prefixo 'test_' e o removem no
 * final, inclusive quando algum passo falha.
 */

/**
 * Executa a bateria completa.
 * @return {!Object} { passed, failed, results }
 */
function runAllTests() {
  var results = [];
  var username = 'test_' + Utilities.getUuid().substring(0, 8).replace(/-/g, '');
  var password = 'senha1234';
  var context = { username: username, password: password, token: null, userId: null };

  var tests = [
    { name: 'setup cria todas as abas', fn: test_setupSheets_ },
    { name: 'contrato so promete funcao existente', fn: test_contrato_ },
    { name: 'bootstrap sem token serve a tela de login', fn: test_bootstrapAnonimo_ },
    { name: 'registro cria usuario e progresso', fn: test_register_ },
    { name: 'registro duplicado e rejeitado', fn: test_duplicateRegister_ },
    { name: 'senha curta e rejeitada', fn: test_shortPassword_ },
    { name: 'login devolve token', fn: test_login_ },
    { name: 'credenciais rejeitam tipos nao textuais', fn: test_authInputTypes_ },
    { name: 'sessao sobrevive ao descarte do cache', fn: test_sessionDurability_ },
    { name: 'login limita sessoes simultaneas', fn: test_sessionLimit_ },
    { name: 'logout invalida sessao em cache e planilha', fn: test_sessionInvalidation_ },
    { name: 'bootstrap autenticado hidrata o cliente', fn: test_bootstrapAutenticado_ },
    { name: 'login com senha errada falha', fn: test_wrongPassword_ },
    { name: 'perfil exige sessao valida', fn: test_profileRequiresSession_ },
    { name: 'perfil rejeita campos nao editaveis', fn: test_updateProfile_ },
    { name: 'troca de senha preserva apenas a sessao atual', fn: test_changePassword_ },
    { name: 'dados e progresso respeitam autoridade do servidor', fn: test_progressApi_ },
    { name: 'rascunho pedagogico valida nivel e textos', fn: test_learningDraft_ },
    { name: 'experiencia narrativa usa estado persistido', fn: test_experienceStateAuthority_ },
    { name: 'decisao narrativa e serializada por lock', fn: test_experienceDecisionAtomic_ },
    { name: 'capitulo narrativo valida identificador', fn: test_experienceChapterInput_ },
    { name: 'experiencia preserva estados narrativos zerados', fn: test_experienceZeroState_ },
    { name: 'CRUD generico faz round-trip', fn: test_crudRoundTrip_ },
    { name: 'upsert preserva uma unica linha', fn: test_upsertAtomic_ },
    { name: 'recompensas de conquistas contam cada id uma vez', fn: test_achievementRewards_ },
    { name: 'partida completa grava pontuacao', fn: test_gameFlow_ },
    { name: 'historico pedagogico isola cada usuario', fn: test_learningHistoryIsolation_ },
    { name: 'partida antiga nao encerra a atual', fn: test_gameIdentity_ },
    { name: 'pontuacao invalida nao encerra nem grava partida', fn: test_invalidScoreSubmission_ },
    { name: 'abandono exige a partida ativa e e serializado', fn: test_abandonGameAtomic_ },
    { name: 'nivel bloqueado e recusado', fn: test_lockedLevel_ },
    { name: 'configuracoes validam valores', fn: test_settings_ },
    { name: 'ranking inclui o jogador', fn: test_leaderboard_ },
    { name: 'identificador de nivel exige inteiro', fn: test_levelInputTypes_ },
    { name: 'inventario, compra e conquistas usam as APIs publicas', fn: test_inventoryApi_ },
    { name: 'compra acima da capacidade preserva moedas e inventario', fn: test_purchaseCapacity_ },
    { name: 'quantidade invalida nao compra nem consome itens', fn: test_inventoryQuantity_ },
    { name: 'ultima unidade so pode ser consumida uma vez', fn: test_inventoryLastUnit_ },
    { name: 'compra legada usa o saldo e o catalogo da loja', fn: test_inventoryLegacyBuy_ },
    { name: 'inventario informa os precos cobrados pela loja', fn: test_inventoryPrices_ },
    { name: 'painel administrativo exige e aceita papel correto', fn: test_adminDashboard_ },
    { name: 'criacao de admin nao usa credencial fixa', fn: test_createAdmin_ },
    { name: 'logout invalida o token', fn: test_logout_ }
  ];

  tests.forEach(function (test) {
    try {
      test.fn(context);
      results.push({ name: test.name, status: 'PASS' });
    } catch (err) {
      results.push({ name: test.name, status: 'FAIL', message: err && err.message });
    }
  });

  cleanupTestUser_(context);

  var failed = results.filter(function (r) { return r.status === 'FAIL'; });
  var summary = {
    passed: results.length - failed.length,
    failed: failed.length,
    results: results
  };

  Logger.log(results.map(function (r) {
    return r.status + ' - ' + r.name + (r.message ? ' :: ' + r.message : '');
  }).join('\n'));
  Logger.log('Total: ' + summary.passed + ' passaram, ' + summary.failed + ' falharam.');
  return summary;
}

// --- Asserts ----------------------------------------------------------------

/** @param {boolean} condition @param {string} message */
function assert_(condition, message) {
  if (!condition) throw new Error(message);
}

/** @param {*} actual @param {*} expected @param {string} label */
function assertEqual_(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + ': esperado ' + JSON.stringify(expected) +
                    ', recebido ' + JSON.stringify(actual));
  }
}

/**
 * Verifica que o envelope e uma falha com o codigo esperado.
 * @param {!Object} response
 * @param {string} expectedCode
 * @param {string} label
 */
function assertFailure_(response, expectedCode, label) {
  assert_(response.ok === false, label + ': esperava falha, veio sucesso.');
  assertEqual_(response.error.code, expectedCode, label + ' (codigo)');
}

/**
 * Verifica sucesso e devolve o payload.
 * @param {!Object} response
 * @param {string} label
 * @return {*}
 */
function assertSuccess_(response, label) {
  assert_(response.ok === true,
          label + ': ' + (response.error ? response.error.message : 'falhou'));
  return response.data;
}

function learningEvidence_(levelId) {
  var level = GameConstants.getLevel(levelId || 1);
  var pair = level.words[0];
  return {
    prediction: 'A ação apresentada pode alterar o território.',
    causalPair: pair.word + ' → ' + pair.spits,
    mechanism: 'A ação modifica uma condição do ambiente e aumenta o risco observado.',
    evidence: 'Observei a relação destacada durante o percurso.',
    revision: 'Agora explicaria a hipótese incluindo o mecanismo intermediário.'
  };
}

// --- Casos de teste ---------------------------------------------------------

/** @param {!Object} ctx */
function test_setupSheets_(ctx) {
  var names = SheetManager.ensureAllSheets();
  Object.keys(Config.SHEETS).forEach(function (key) {
    assert_(names.indexOf(Config.SHEETS[key]) !== -1,
            'Aba ausente: ' + Config.SHEETS[key]);
  });
}

/**
 * O contrato e a unica lista de operacoes: se ele citar uma funcao que nao
 * existe, o cliente monta um metodo que estoura so quando o usuario clica.
 * @param {!Object} ctx
 */
function test_contrato_(ctx) {
  var ausentes = ApiContract.operacoesAusentes();
  assertEqual_(ausentes.length, 0,
               'operacoes do contrato sem funcao correspondente: ' + ausentes.join(', '));

  var paraCliente = ApiContract.paraCliente();
  assertEqual_(paraCliente.versao, ApiContract.VERSION, 'versao do contrato');
  assert_(paraCliente.codigos.UNAUTHORIZED === Errors.CODES.UNAUTHORIZED,
          'o contrato deve levar os codigos de erro do backend');

  var nomesCliente = paraCliente.operacoes.map(function (op) { return op.cliente; });
  assertEqual_(nomesCliente.length, new_setSize_(nomesCliente),
               'nomes de cliente duplicados no contrato');

  paraCliente.operacoes.forEach(function (op) {
    assert_(['obrigatorio', 'opcional', 'nenhum', 'explicito'].indexOf(op.token) !== -1,
            'operacao ' + op.fn + ' com politica de token invalida: ' + op.token);
  });
}

/**
 * @param {!Array<string>} lista
 * @return {number} Quantidade de valores distintos.
 */
function new_setSize_(lista) {
  var vistos = {};
  lista.forEach(function (item) { vistos[item] = true; });
  return Object.keys(vistos).length;
}

/** @param {!Object} ctx */
function test_bootstrapAnonimo_(ctx) {
  var payload = assertSuccess_(api_bootstrap(null), 'bootstrap anonimo');

  assertEqual_(payload.sessao.valida, false, 'sessao sem token');
  assertEqual_(payload.sessao.usuario, null, 'nao deve vazar usuario');
  assertEqual_(payload.configuracoes, null, 'nao deve vazar configuracoes');
  assert_(payload.contrato.operacoes.length > 0, 'contrato vazio');
  assert_(payload.constantes.levels.length === GameConstants.LEVELS.length,
          'constantes devem trazer os niveis');
  assertEqual_(payload.niveis.length, GameConstants.LEVELS.length, 'niveis publicos');
  assertEqual_(payload.niveis[0].unlocked, false,
               'visitante nao autenticado nao tem nivel liberado');

  // Token invalido nao e erro na abertura: e o caso comum de sessao vencida.
  var comLixo = assertSuccess_(api_bootstrap('token-que-nao-existe'),
                               'bootstrap com token invalido');
  assertEqual_(comLixo.sessao.valida, false, 'token invalido');
}

/** @param {!Object} ctx */
function test_bootstrapAutenticado_(ctx) {
  var payload = assertSuccess_(api_bootstrap(ctx.token), 'bootstrap autenticado');

  assertEqual_(payload.sessao.valida, true, 'sessao valida');
  assertEqual_(payload.sessao.usuario.username, ctx.username, 'usuario da sessao');
  assert_(payload.sessao.usuario.password === undefined,
          'bootstrap nao deve expor senha');
  assert_(!Utils.isBlank(payload.sessao.expiraEm), 'deve informar quando expira');

  assertEqual_(payload.progresso.currentLevel, 1, 'progresso na abertura');
  assertEqual_(payload.niveis[0].unlocked, true, 'nivel 1 liberado');
  assertEqual_(payload.niveis[1].unlocked, false, 'nivel 2 ainda bloqueado');
  assertEqual_(payload.configuracoes.difficulty,
               GameConstants.DEFAULT_SETTINGS.difficulty, 'configuracoes padrao');

  // A abertura substitui quatro chamadas: o payload precisa cobrir as quatro.
  ['contrato', 'constantes', 'sessao', 'progresso', 'niveis', 'configuracoes']
      .forEach(function (campo) {
        assert_(payload[campo] !== undefined, 'bootstrap sem o campo ' + campo);
      });
}

/** @param {!Object} ctx */
function test_register_(ctx) {
  var profile = assertSuccess_(
      api_register(ctx.username, ctx.password, ctx.username + '@example.com'),
      'registro');
  assertEqual_(profile.username, ctx.username, 'username');
  assert_(profile.password === undefined, 'perfil publico nao deve expor senha');
  ctx.userId = profile.id;

  var progress = ProgressService.getProgress(profile.id);
  assertEqual_(progress.currentLevel, 1, 'nivel inicial');
  assertEqual_(progress.maxLevelReached, 1, 'nivel maximo inicial');
}

/** @param {!Object} ctx */
function test_duplicateRegister_(ctx) {
  assertFailure_(api_register(ctx.username, ctx.password),
                 Errors.CODES.CONFLICT, 'registro duplicado');
}

/** @param {!Object} ctx */
function test_shortPassword_(ctx) {
  assertFailure_(api_register('test_curta_' + Date.now(), 'ab'),
                 Errors.CODES.VALIDATION, 'senha curta');
}

/** @param {!Object} ctx */
function test_login_(ctx) {
  var data = assertSuccess_(api_login(ctx.username, ctx.password), 'login');
  assert_(!Utils.isBlank(data.token), 'token vazio');
  assertEqual_(data.user.username, ctx.username, 'usuario da sessao');
  ctx.token = data.token;

  var profile = assertSuccess_(api_getProfile(ctx.token), 'perfil');
  assertEqual_(profile.id, ctx.userId, 'id do perfil');
}

/** @param {!Object} ctx */
function test_authInputTypes_(ctx) {
  [123456, true, false, ['aluno01'], { value: 'aluno01' }, null].forEach(function (value) {
    assertFailure_(api_register(value, 'senha1234'), Errors.CODES.VALIDATION,
                   'usuario nao textual: ' + JSON.stringify(value));
  });
  [123456, true, false, ['senha1234'], { value: 'senha1234' }, null].forEach(function (value) {
    assertFailure_(api_register('test_auth_' + Utilities.getUuid().substring(0, 6), value),
                   Errors.CODES.VALIDATION,
                   'senha nao textual: ' + JSON.stringify(value));
  });
  assertFailure_(api_register('test_auth_' + Utilities.getUuid().substring(0, 6),
                              'senha1234', ['teste@example.com']),
                 Errors.CODES.VALIDATION, 'e-mail nao textual');
  assertFailure_(api_login(ctx.username, ['senha1234']),
                 Errors.CODES.VALIDATION, 'login nao aceita senha em lista');
  assertFailure_(api_changePassword(ctx.token, ['senha1234'], 'senhaNova1234'),
                 Errors.CODES.VALIDATION, 'troca nao aceita senha atual em lista');
}

/** @param {!Object} ctx */
function test_sessionDurability_(ctx) {
  var rows = CrudService.findBy(Config.SHEETS.SESSIONS, { userId: ctx.userId });
  assertEqual_(rows.length, 1, 'sessao persistida');
  assert_(rows[0].tokenHash !== ctx.token, 'token nao deve ser gravado em claro');

  CacheService.getScriptCache().remove(SessionManager.cacheKey_(ctx.token));
  var profile = assertSuccess_(api_getProfile(ctx.token), 'perfil apos descarte do cache');
  assertEqual_(profile.id, ctx.userId, 'sessao reconstruida da planilha');
}

/** @param {!Object} ctx */
function test_sessionLimit_(ctx) {
  var suffix = Utilities.getUuid().substring(0, 8).replace(/-/g, '');
  var profile = assertSuccess_(
      api_register('test_session_' + suffix, 'senha1234'), 'usuario para limite de sessoes');
  var sessions = [];
  try {
    for (var i = 0; i < Config.MAX_SESSIONS_PER_USER + 2; i++) {
      var created = SessionManager.createSession({
        id: profile.id, username: profile.username, role: profile.role
      });
      sessions.push(created.token);
    }
    var rows = CrudService.findBy(Config.SHEETS.SESSIONS, { userId: profile.id });
    assertEqual_(rows.length, Config.MAX_SESSIONS_PER_USER,
                 'limite de sessoes persistidas');
    sessions.forEach(function (token) {
      assert_(SessionManager.getSession(token) !== null ||
              sessions.indexOf(token) < sessions.length - Config.MAX_SESSIONS_PER_USER,
              'sessoes recentes devem permanecer validas');
    });
  } finally {
    UserService.deleteUser(profile.id);
  }
}

/** @param {!Object} ctx */
function test_sessionInvalidation_(ctx) {
  var profile = assertSuccess_(
      api_register('test_logout_' + Utilities.getUuid().substring(0, 8), 'senha1234'),
      'usuario para invalidacao');
  var login = assertSuccess_(api_login(profile.username, 'senha1234'),
                             'sessao para invalidacao');
  try {
    assertSuccess_(api_logout(login.token), 'logout persistente');
    assertEqual_(assertSuccess_(api_validateSession(login.token), 'validar logout').valid,
                 false, 'sessao invalida apos logout');
    assertEqual_(CrudService.findBy(Config.SHEETS.SESSIONS, {
      tokenHash: SessionManager.hashToken_(login.token)
    }).length, 0, 'sessao removida da planilha');
  } finally {
    UserService.deleteUser(profile.id);
  }
}

/** @param {!Object} ctx */
function test_wrongPassword_(ctx) {
  assertFailure_(api_login(ctx.username, ctx.password + 'x'),
                 Errors.CODES.UNAUTHORIZED, 'senha errada');
}

/** @param {!Object} ctx */
function test_profileRequiresSession_(ctx) {
  assertFailure_(api_getProfile('token-inexistente'),
                 Errors.CODES.UNAUTHORIZED, 'sessao invalida');
  [true, false, [], [ctx.token], { token: ctx.token }, 123].forEach(function (token) {
    assertFailure_(api_getProfile(token), Errors.CODES.UNAUTHORIZED,
                   'token deve ser texto: ' + JSON.stringify(token));
  });
  [true, false, [], [ctx.token], { token: ctx.token }, 123].forEach(function (token) {
    var validation = assertSuccess_(api_validateSession(token),
                                    'validar token nao textual');
    assertEqual_(validation.valid, false,
                 'token nao textual nao pode validar');
  });
}

/** @param {!Object} ctx */
function test_updateProfile_(ctx) {
  var updated = assertSuccess_(
      api_updateProfile(ctx.token, { email: 'TESTE@EXAMPLE.COM' }),
      'atualizar perfil');
  assertEqual_(updated.email, 'teste@example.com', 'email normalizado');

  [[], ['aluno@example.com'], { value: 'aluno@example.com' }, 123, true]
      .forEach(function (email) {
        assertFailure_(api_updateProfile(ctx.token, { email: email }),
                       Errors.CODES.VALIDATION,
                       'email deve ser texto: ' + JSON.stringify(email));
      });

  assertFailure_(api_updateProfile(ctx.token, { coins: 999 }),
                 Errors.CODES.VALIDATION, 'campo protegido do perfil');
}

/** @param {!Object} ctx */
function test_changePassword_(ctx) {
  var oldPassword = ctx.password;
  var newPassword = 'senhaNova1234';
  var previousSession = assertSuccess_(api_login(ctx.username, oldPassword),
                                       'segunda sessao antes da troca');
  assertSuccess_(api_changePassword(ctx.token, oldPassword, newPassword),
                 'trocar senha');
  assertFailure_(api_getProfile(previousSession.token),
                 Errors.CODES.UNAUTHORIZED, 'outra sessao invalidada');
  assertFailure_(api_login(ctx.username, oldPassword),
                 Errors.CODES.UNAUTHORIZED, 'senha antiga');

  var another = assertSuccess_(api_login(ctx.username, newPassword),
                               'login com senha nova');
  assertSuccess_(api_logout(another.token), 'encerrar sessao adicional');
  ctx.password = newPassword;

  var current = assertSuccess_(api_getProfile(ctx.token), 'sessao atual preservada');
  assertEqual_(current.id, ctx.userId, 'usuario da sessao preservada');
}

/** @param {!Object} ctx */
function test_progressApi_(ctx) {
  var constants = assertSuccess_(api_getGameData(), 'dados do jogo');
  assertEqual_(constants.levels.length, GameConstants.LEVELS.length,
               'quantidade de niveis');

  var levels = assertSuccess_(api_getLevelSelection(ctx.token), 'selecao de niveis');
  assertEqual_(levels[0].unlocked, true, 'nivel inicial liberado');

  var progress = assertSuccess_(api_getProgress(ctx.token), 'ler progresso');
  var saved = assertSuccess_(api_saveProgress(ctx.token, {
    currentLevel: 1,
    state: { checkpoint: { levelId: 1, distance: 100 } }
  }), 'salvar checkpoint');
  assertEqual_(saved.state.checkpoint.distance, 100, 'checkpoint persistido');
  assertEqual_(saved.totalDistance, progress.totalDistance,
               'checkpoint nao altera distancia total');

  assertFailure_(api_saveProgress(ctx.token, { totalDistance: 999999 }),
                 Errors.CODES.VALIDATION, 'distancia controlada pelo servidor');
  assertFailure_(api_saveProgress(ctx.token, {
    state: { levelsCompleted: [1, 2, 3] }
  }), Errors.CODES.VALIDATION, 'conclusoes controladas pelo servidor');

  [0, 1.5, 'abc', false, [], {}].forEach(function (value) {
    assertFailure_(api_saveProgress(ctx.token, { currentLevel: value }),
                   Errors.CODES.VALIDATION,
                   'nivel atual nao aceita coercao: ' + JSON.stringify(value));
  });
  [
    { levelId: 'abc', distance: 0 },
    { levelId: 1, distance: null },
    { levelId: 1, distance: false },
    { levelId: 1, distance: [] },
    { levelId: [], distance: 0 },
    { levelId: 1, distance: 'abc' }
  ].forEach(function (checkpoint) {
    assertFailure_(api_saveProgress(ctx.token, { state: { checkpoint: checkpoint } }),
                   Errors.CODES.VALIDATION,
                   'checkpoint nao aceita coercao: ' + JSON.stringify(checkpoint));
  });
  var fractional = assertSuccess_(api_saveProgress(ctx.token, {
    state: { checkpoint: { levelId: '1', distance: 1.5 } }
  }), 'distancia fracionaria normalizada');
  assertEqual_(fractional.state.checkpoint.distance, 2,
               'distancia fracionaria continua sendo arredondada');
}

/** @param {!Object} ctx */
function test_learningDraft_(ctx) {
  assertFailure_(api_saveLearningDraft(ctx.token, 999, {}),
                 Errors.CODES.VALIDATION, 'rascunho com nivel inexistente');
  var fields = ['prediction', 'causalPair', 'mechanism', 'evidence', 'revision'];
  [true, 123, ['texto'], { value: 'texto' }].forEach(function (value) {
    fields.forEach(function (field) {
      var draft = learningEvidence_(1);
      draft[field] = value;
      assertFailure_(api_saveLearningDraft(ctx.token, 1, draft),
                     Errors.CODES.VALIDATION,
                     'campo nao textual: ' + field + ' = ' + JSON.stringify(value));
    });
  });
  var partial = assertSuccess_(api_saveLearningDraft(ctx.token, '1', {
    prediction: 'Hipotese parcial sobre o ambiente.'
  }), 'rascunho parcial valido');
  assertEqual_(partial.levelId, '1', 'nivel do rascunho preservado');
  assertEqual_(partial.draft.prediction, 'Hipotese parcial sobre o ambiente.',
               'texto do rascunho preservado');
  assert_(partial.completeness > 0, 'rascunho parcial calcula completude');
}

/** @param {!Object} ctx */
function test_experienceStateAuthority_(ctx) {
  var before = ProgressService.getProgress(ctx.userId);
  try {
    assertFailure_(api_makeExperienceDecision(
        ctx.token, {}, ['observar'], 'coletar', 'Evidencia.'),
        Errors.CODES.VALIDATION, 'capitulo narrativo deve ser texto');
    assertFailure_(api_makeExperienceDecision(
        ctx.token, {}, 'observar', ['coletar'], 'Evidencia.'),
        Errors.CODES.VALIDATION, 'escolha narrativa deve ser texto');
    assertFailure_(api_makeExperienceDecision(
        ctx.token, {}, 'observar', 'coletar', { texto: 'Evidencia.' }),
        Errors.CODES.VALIDATION, 'evidencia narrativa deve ser texto');
    var first = assertSuccess_(api_makeExperienceDecision(
        ctx.token,
        { chapter: 99, knowledge: 10, cooperation: 10, pressure: 0 },
        'observar', 'coletar', 'Evidencia registrada pelo grupo.'),
        'primeira decisao narrativa');
    assertEqual_(first.nextState.chapter, 2, 'capitulo avancado pela ordem persistida');
    assertEqual_(first.nextState.knowledge, 7, 'conhecimento parte do estado padrao');
    assertEqual_(first.nextState.cooperation, 6, 'cooperacao parte do estado padrao');
    assertEqual_(first.nextState.pressure, 1, 'pressao parte do estado padrao');

    var saved = ProgressService.getProgress(ctx.userId);
    assertEqual_(saved.state.experienceState.knowledge, 7,
                 'estado narrativo persistido');
    assertFailure_(api_makeExperienceDecision(
        ctx.token,
        { chapter: 1, knowledge: 10, cooperation: 10, pressure: 0 },
        'observar', 'coletar', 'Tentativa fora de ordem.'),
        Errors.CODES.CONFLICT, 'capitulo antigo rejeitado');

    var second = assertSuccess_(api_makeExperienceDecision(
        ctx.token,
        { chapter: 2, knowledge: 0, cooperation: 0, pressure: 10 },
        'rio-mudou', 'investigar', 'Evidencia da segunda rodada.'),
        'segunda decisao narrativa');
    assertEqual_(second.nextState.knowledge, 9,
                 'segunda decisao usa conhecimento persistido');
    assertEqual_(second.nextState.cooperation, 7,
                 'segunda decisao usa cooperacao persistida');
    assertEqual_(second.nextState.pressure, 0,
                 'segunda decisao usa pressao persistida');
  } finally {
    ProgressService.updateRow_(ctx.userId, { state: before.state });
  }
}

/** @param {!Object} ctx */
function test_experienceChapterInput_(ctx) {
  var chapter = assertSuccess_(api_getExperienceChapter(ctx.token, 'observar', 3),
                               'capitulo narrativo valido');
  assertEqual_(chapter.data.title, 'Cartas do vento',
               'capitulo valido deve retornar seus dados');

  [null, undefined, [], ['observar'], {}, 'nao-existe'].forEach(function (chapterId) {
    assertFailure_(api_getExperienceChapter(ctx.token, chapterId, 3),
                   Errors.CODES.VALIDATION,
                   'capitulo invalido: ' + JSON.stringify(chapterId));
  });
}

/** @param {!Object} ctx */
function test_experienceDecisionAtomic_(ctx) {
  var before = ProgressService.getProgress(ctx.userId);
  var originalWithLock = SheetManager.withLock;
  var depth = 0;
  var outerCalls = 0;
  SheetManager.withLock = function (fn) {
    if (depth === 0) outerCalls++;
    depth++;
    try {
      return fn();
    } finally {
      depth--;
    }
  };
  try {
    assertSuccess_(api_makeExperienceDecision(
        ctx.token, {}, 'observar', 'coletar', 'Evidencia serializada.'),
        'decisao sob lock');
  } finally {
    SheetManager.withLock = originalWithLock;
    ProgressService.updateRow_(ctx.userId, { state: before.state });
  }
  assertEqual_(outerCalls, 1,
               'a decisao deve envolver leitura e escrita em um unico lock');
}

/** @param {!Object} ctx */
function test_experienceZeroState_(ctx) {
  var result = resolveExperienceDecision(
      { chapter: 2, knowledge: 0, cooperation: 0, pressure: 0 },
      'rio-mudou', 'investigar', 'Evidencia com estado zerado.');
  assertEqual_(result.previousState.knowledge, 0,
               'conhecimento zerado deve permanecer zerado');
  assertEqual_(result.previousState.cooperation, 0,
               'cooperacao zerada deve permanecer zerada');
  assertEqual_(result.previousState.pressure, 0,
               'pressao zerada deve permanecer zerada');
  assertEqual_(result.nextState.knowledge, 2,
               'decisao deve partir do conhecimento zerado');
  assertEqual_(result.nextState.cooperation, 1,
               'decisao deve partir da cooperacao zerada');
  assertEqual_(result.nextState.pressure, 0,
               'pressao nao deve ressurgir por valor padrao');

  var endgame = getExperienceEndgame({ knowledge: 0, cooperation: 0, pressure: 0 });
  assertEqual_(endgame.finalState.knowledge, 0,
               'desfecho deve conservar conhecimento zerado');
  assertEqual_(endgame.finalState.cooperation, 0,
               'desfecho deve conservar cooperacao zerada');
  assertEqual_(endgame.finalState.pressure, 0,
               'desfecho deve conservar pressao zerada');

  var review = advanceExperienceBasicWorkflow({
    gameId: 'sobre-encantos', chapterId: 'relacionar', stage: 'briefing',
    state: { chapter: 3, knowledge: 0, cooperation: 6, pressure: 2 }
  }, {}, 3);
  assert_(review.needsReview === true,
          'conhecimento zerado deve exigir revisao antes da nova fase');
}

/** @param {!Object} ctx */
function test_crudRoundTrip_(ctx) {
  var ownerId = 'crud-test-' + Utilities.getUuid();
  var created = CrudService.create(Config.SHEETS.SETTINGS, {
    userId: ownerId,
    settings: { musicVolume: 0.1, nested: { ok: true } }
  });

  // O remove fica no finally: um assert que falhe no meio nao deve deixar
  // linha orfa na planilha.
  try {
    assert_(!Utils.isBlank(created.id), 'id gerado');

    var found = CrudService.findById(Config.SHEETS.SETTINGS, created.id);
    assert_(found !== null, 'registro nao encontrado apos create');
    assertEqual_(found.settings.nested.ok, true, 'campo JSON aninhado');
    assertEqual_(found.userId, ownerId, 'userId gravado');

    var updated = CrudService.update(Config.SHEETS.SETTINGS, created.id,
                                     { settings: { musicVolume: 0.9 } });
    assertEqual_(updated.settings.musicVolume, 0.9, 'update de campo JSON');
    assertEqual_(updated.userId, ownerId, 'update preserva campo fora do patch');
    assertEqual_(updated.createdAt, created.createdAt, 'update preserva createdAt');
    assert_(new Date(updated.updatedAt).getTime() >=
            new Date(created.createdAt).getTime(), 'updatedAt >= createdAt');

    // O patch nao deve criar linha nova.
    assertEqual_(CrudService.findBy(Config.SHEETS.SETTINGS, { userId: ownerId }).length, 1,
                 'update nao deve duplicar linha');
  } finally {
    CrudService.remove(Config.SHEETS.SETTINGS, created.id);
  }

  assertEqual_(CrudService.findById(Config.SHEETS.SETTINGS, created.id), null,
               'registro apos remove');
}

/** @param {!Object} ctx */
function test_upsertAtomic_(ctx) {
  var ownerId = 'upsert-test-' + Utilities.getUuid();
  var first = CrudService.upsert(Config.SHEETS.SETTINGS, { userId: ownerId }, {
    settings: { musicVolume: 0.1 }
  });
  try {
    var second = CrudService.upsert(Config.SHEETS.SETTINGS, { userId: ownerId }, {
      settings: { musicVolume: 0.9 }
    });
    assertEqual_(second.id, first.id, 'upsert deve reutilizar a mesma linha');
    assertEqual_(CrudService.findBy(Config.SHEETS.SETTINGS, { userId: ownerId }).length, 1,
                 'upsert nao deve duplicar linha');
    assertEqual_(second.settings.musicVolume, 0.9, 'upsert atualiza a linha existente');
  } finally {
    CrudService.remove(Config.SHEETS.SETTINGS, first.id);
  }
}

/** @param {!Object} ctx */
function test_achievementRewards_(ctx) {
  assertEqual_(AchievementService.rewardCoinsFor([
    'first-flight', 'high-score', 'first-flight', 'unknown'
  ]), 35, 'recompensas devem somar ids conhecidos sem duplicar');
  assertEqual_(AchievementService.rewardCoinsFor(null), 0,
               'lista ausente nao deve gerar recompensa');
}

/** @param {!Object} ctx */
function test_gameFlow_(ctx) {
  var start = assertSuccess_(api_startGame(ctx.token, 1), 'inicio de partida');
  assertEqual_(start.level.id, 1, 'nivel iniciado');
  assertEqual_(start.level.city, 'Sao Paulo', 'cidade do nivel 1');

  var submission = {
    gameId: start.gameId, score: 1000, distance: 1200, coins: 15, completed: true,
    learning: learningEvidence_(1)
  };
  var end = assertSuccess_(api_endGame(ctx.token, submission), 'fim de partida');

  var expected = Math.round(1000 * GameConstants.getDifficulty('normal').scoreMultiplier) +
                 GameConstants.SCORING.LEVEL_COMPLETE_BONUS;
  assertEqual_(end.score, expected, 'pontuacao final com bonus');
  assert_(end.isNewBest === true, 'primeira partida deve ser recorde');
  assertEqual_(end.progress.maxLevelReached, 2, 'nivel 2 liberado');
  assertEqual_(end.progress.totalDistance, 1200,
               'distancia da conclusao somada ao progresso');
  assertEqual_(end.state.profile.coins, end.coinBalance,
               'estado devolvido deve trazer o saldo persistido');
  assertEqual_(end.achievementRewardCoins, 55,
               'conquistas novas devem creditar suas recompensas');
  assertEqual_(end.state.levels[1].unlocked, true,
               'estado devolvido deve trazer o proximo nivel liberado');
  assert_(end.newAchievements.some(function (item) {
    return item.id === 'first-flight';
  }), 'primeiro voo deve ser notificado como nova conquista');
  var journals = CrudService.findBy(Config.SHEETS.LEARNING_JOURNALS, { userId: ctx.userId });
  assertEqual_(journals.length, 1, 'caderno individual persistido');
  assertEqual_(end.learningJournalId, journals[0].id, 'caderno ligado ao resultado');
  assertEqual_(Utils.toInt(journals[0].completeness), 100,
               'completude persistida no caderno');

  var stats = assertSuccess_(api_getMyStats(ctx.token), 'estatisticas');
  assertEqual_(stats.gamesPlayed, 1, 'partidas jogadas');
  assertEqual_(stats.bestScore, expected, 'melhor pontuacao');

  // O mesmo clique reenviado não pode repetir nenhum efeito persistente.
  assertFailure_(api_endGame(ctx.token, submission),
                 Errors.CODES.VALIDATION, 'submissao idempotente repetida');
  var afterDuplicate = assertSuccess_(api_getMyStats(ctx.token),
                                      'estatisticas apos duplicata');
  assertEqual_(afterDuplicate.gamesPlayed, 1, 'duplicata nao cria novo score');

  var replay = ProgressService.completeLevel(ctx.userId, 1, 100);
  assertEqual_(replay.currentLevel, 2, 'replay nao regride nivel atual');
  assertEqual_(replay.totalDistance, 1300, 'replay soma distancia');

  // Sem partida ativa, encerrar deve falhar.
  assertFailure_(api_endGame(ctx.token, { score: 10 }),
                 Errors.CODES.VALIDATION, 'fim sem partida ativa');
}

/** @param {!Object} ctx */
function test_learningHistoryIsolation_(ctx) {
  var profile = assertSuccess_(
      api_register('test_history_' + Utilities.getUuid().substring(0, 8), 'senha1234'),
      'usuario para isolamento do historico');
  try {
    CrudService.create(Config.SHEETS.LEARNING_JOURNALS, {
      userId: profile.id,
      gameId: 'journal-other-user',
      levelId: 1,
      city: 'Sao Paulo',
      prediction: 'Registro de outro usuario.',
      causalPair: 'DESMATAMENTO → ENCHENTE',
      mechanism: 'Mecanismo de outro usuario.',
      evidence: 'Evidencia de outro usuario.',
      revision: 'Revisao de outro usuario.',
      completed: false,
      score: 0,
      completeness: 100
    });
    var history = assertSuccess_(api_getLearningHistory(ctx.token, 50),
                                 'historico do usuario atual');
    assert_(history.length > 0, 'historico principal deve conter registros');
    assert_(history.every(function (entry) {
      return entry.userId === ctx.userId;
    }), 'historico nao pode expor registros de outro usuario');
  } finally {
    UserService.deleteUser(profile.id);
  }
}

/** @param {!Object} ctx */
function test_gameIdentity_(ctx) {
  var first = assertSuccess_(api_startGame(ctx.token, 1), 'primeira partida');
  var second = assertSuccess_(api_startGame(ctx.token, 1), 'partida substituta');

  assertFailure_(api_endGame(ctx.token, {
    gameId: first.gameId, score: 10, distance: 10, coins: 0, completed: false
  }), Errors.CODES.CONFLICT, 'resultado atrasado');

  assertFailure_(api_endGame(ctx.token, {
    gameId: second.gameId, score: 10, distance: 10, coins: 0, completed: true
  }), Errors.CODES.VALIDATION, 'conclusao sem distancia suficiente');

  assertSuccess_(api_abandonGame(ctx.token, second.gameId),
                 'abandono da partida ativa');
}

/** @param {!Object} ctx */
function test_invalidScoreSubmission_(ctx) {
  var start = assertSuccess_(api_startGame(ctx.token, 1), 'partida para validar pontuacao');
  var beforeStats = assertSuccess_(api_getMyStats(ctx.token), 'estatisticas antes da pontuacao invalida');
  var beforeProfile = assertSuccess_(api_getProfile(ctx.token), 'perfil antes da pontuacao invalida');
  var invalidValues = [undefined, '', false, true, [], [1], {}, 'abc', 1.5, -1, Infinity];

  invalidValues.forEach(function (value) {
    assertFailure_(api_endGame(ctx.token, {
      gameId: start.gameId, score: value, distance: 0, coins: 0, completed: false,
      learning: learningEvidence_(1)
    }), Errors.CODES.VALIDATION, 'pontuacao invalida: ' + JSON.stringify(value));
  });

  var afterStats = assertSuccess_(api_getMyStats(ctx.token), 'estatisticas apos rejeicoes');
  assertEqual_(afterStats.gamesPlayed, beforeStats.gamesPlayed,
               'rejeicao nao grava pontuacao');
  var afterProfile = assertSuccess_(api_getProfile(ctx.token), 'perfil apos rejeicoes');
  assertEqual_(afterProfile.coins, beforeProfile.coins, 'rejeicao nao credita moedas');
  assertEqual_(afterProfile.progress.totalDistance, beforeProfile.progress.totalDistance,
               'rejeicao nao altera progresso');

  var valid = assertSuccess_(api_endGame(ctx.token, {
    gameId: start.gameId, score: '10', distance: 0, coins: 0, completed: false,
    learning: learningEvidence_(1)
  }), 'pontuacao numerica em texto');
  assertEqual_(valid.score, 10, 'texto numerico aceito sem truncamento');
  assertEqual_(assertSuccess_(api_getMyStats(ctx.token), 'estatisticas finais').gamesPlayed,
               beforeStats.gamesPlayed + 1, 'partida valida gravada apos rejeicoes');
}

/** @param {!Object} ctx */
function test_abandonGameAtomic_(ctx) {
  var first = assertSuccess_(api_startGame(ctx.token, 1), 'partida para abandono');
  assertFailure_(api_abandonGame(ctx.token, 'game-inexistente'),
                 Errors.CODES.CONFLICT, 'abandono de partida errada');

  // A tentativa rejeitada não pode remover a partida que continua ativa.
  assertSuccess_(api_abandonGame(ctx.token, first.gameId), 'abandono da partida correta');
  assertFailure_(api_abandonGame(ctx.token, first.gameId),
                 Errors.CODES.VALIDATION, 'abandono sem partida ativa');

  var second = assertSuccess_(api_startGame(ctx.token, 1), 'partida substituta para abandono');
  assertSuccess_(api_abandonGame(ctx.token, second.gameId), 'abandono final');
}

/** @param {!Object} ctx */
function test_lockedLevel_(ctx) {
  assertFailure_(api_startGame(ctx.token, 10),
                 Errors.CODES.FORBIDDEN, 'nivel bloqueado');
  assertFailure_(api_startGame(ctx.token, 999),
                 Errors.CODES.VALIDATION, 'nivel inexistente');
}

/** @param {!Object} ctx */
function test_levelInputTypes_(ctx) {
  [true, false, null, [], [1], {}, '', '1abc', '1.5', 1.5, 0, -1]
      .forEach(function (levelId) {
        assertFailure_(api_startGame(ctx.token, levelId),
                       Errors.CODES.VALIDATION,
                       'nivel deve ser inteiro: ' + JSON.stringify(levelId));
      });

  var started = assertSuccess_(api_startGame(ctx.token, '1'),
                               'nivel numerico em texto');
  assertEqual_(started.level.id, 1, 'texto numerico deve identificar o nivel');
  assertSuccess_(api_abandonGame(ctx.token, started.gameId),
                 'limpar partida do teste de nivel');
}

/** @param {!Object} ctx */
function test_settings_(ctx) {
  var saved = assertSuccess_(
      api_saveSettings(ctx.token, { difficulty: 'hard', musicVolume: 2 }),
      'salvar configuracoes');
  assertEqual_(saved.difficulty, 'hard', 'dificuldade');
  assertEqual_(saved.musicVolume, 1, 'volume deve ser limitado a 1');

  assertFailure_(api_saveSettings(ctx.token, { difficulty: 'impossivel' }),
                 Errors.CODES.VALIDATION, 'dificuldade invalida');
  assertFailure_(api_saveSettings(ctx.token, { campoInventado: true }),
                 Errors.CODES.VALIDATION, 'configuracao desconhecida');
  assertFailure_(api_saveSettings(ctx.token, { musicVolume: 'alto' }),
                 Errors.CODES.VALIDATION, 'volume nao numerico');

  [true, false, null, [], [0.5], {}].forEach(function (value) {
    assertFailure_(api_saveSettings(ctx.token, { musicVolume: value }),
                   Errors.CODES.VALIDATION,
                   'volume nao aceita coercao: ' + JSON.stringify(value));
  });
  [['hard'], true, ['touch'], null].forEach(function (value) {
    assertFailure_(api_saveSettings(ctx.token, { difficulty: value }),
                   Errors.CODES.VALIDATION,
                   'dificuldade nao aceita coercao: ' + JSON.stringify(value));
  });
  assertSuccess_(api_saveSettings(ctx.token, { musicVolume: '0.25' }),
                 'volume numerico em texto');
  assertEqual_(assertSuccess_(api_getSettings(ctx.token), 'ler volume numerico em texto').musicVolume,
               0.25, 'volume numerico em texto convertido');

  var reread = assertSuccess_(api_getSettings(ctx.token), 'ler configuracoes');
  assertEqual_(reread.difficulty, 'hard', 'dificuldade persistida');

  var reset = SettingsService.resetSettings(ctx.token);
  assertEqual_(reset.difficulty, GameConstants.DEFAULT_SETTINGS.difficulty,
               'restaurar padroes');
}

/** @param {!Object} ctx */
function test_leaderboard_(ctx) {
  LeaderboardService.invalidateCache();
  var top = assertSuccess_(api_getLeaderboard(100), 'ranking');
  var mine = top.filter(function (entry) { return entry.username === ctx.username; });
  assertEqual_(mine.length, 1, 'jogador de teste no ranking');
  assertEqual_(mine[0].rank > 0, true, 'rank positivo');

  [true, false, [], {}, '10abc', 1.5].forEach(function (limit) {
    assertFailure_(api_getLeaderboard(limit), Errors.CODES.VALIDATION,
                   'limite de ranking invalido: ' + JSON.stringify(limit));
  });
  [true, false, [], {}, '1abc', 1.5, 0, -1].forEach(function (levelId) {
    assertFailure_(api_getLeaderboard(10, levelId), Errors.CODES.VALIDATION,
                   'filtro de nivel invalido: ' + JSON.stringify(levelId));
  });
  var levelOne = assertSuccess_(api_getLeaderboard('10', '1'),
                                'ranking com parametros numericos em texto');
  assert_(levelOne.every(function (entry) { return entry.level === 1; }),
          'filtro de nivel deve permanecer restrito ao nivel solicitado');
}

/** @param {!Object} ctx */
function test_inventoryApi_(ctx) {
  var balanceBefore = UserService.addCoins(ctx.userId, 100);
  var purchase = assertSuccess_(
      api_buyItem(ctx.token, 'shield', 2), 'comprar item pela API');
  assertEqual_(purchase.balance, balanceBefore - 60,
               'compra debita o saldo creditado pela partida');

  var inventory = assertSuccess_(api_getInventory(ctx.token), 'ler inventario');
  var shield = inventory.filter(function (item) { return item.id === 'shield'; })[0];
  assertEqual_(shield.quantity, 2, 'quantidade comprada');

  var afterUse = assertSuccess_(
      api_useItem(ctx.token, 'shield', 1), 'usar item pela API');
  var remaining = afterUse.filter(function (item) { return item.id === 'shield'; })[0];
  assertEqual_(remaining.quantity, 1, 'quantidade depois do uso');

  var achievements = assertSuccess_(
      api_getAchievements(ctx.token), 'ler conquistas pela API');
  assert_(achievements.some(function (item) {
    return item.id === 'first-flight' && item.unlocked === true;
  }), 'primeiro voo deve estar desbloqueado apos a partida');
}

/** @param {!Object} ctx */
function test_inventoryPrices_(ctx) {
  var listed = InventoryService.listItems();
  var inventory = assertSuccess_(api_getInventory(ctx.token), 'precos do inventario');
  assertEqual_(listed.length, ShopService.list().length, 'quantidade de produtos');
  listed.forEach(function (item) {
    var owned = inventory.filter(function (entry) { return entry.id === item.id; })[0];
    assert_(!!owned, 'item presente no inventario: ' + item.id);
    assertEqual_(item.price, ShopService.quote(item.id, 1).total, 'preco da listagem');
    assertEqual_(owned.price, item.price, 'preco informado pela API');
    assertEqual_(owned.description, item.description, 'descricao preservada');
  });
  var original = listed[0].price;
  listed[0].price = -1;
  inventory[0].price = -2;
  assertEqual_(InventoryService.listItems()[0].price, original, 'retornos independentes');
  assertEqual_(ShopService.quote(listed[0].id, 1).total, original, 'catalogo preservado');
}

/** @param {!Object} ctx */
function test_inventoryLegacyBuy_(ctx) {
  var before = ProgressService.getProgress(ctx.userId);
  var originalBalance = Utils.toInt(UserService.getById(ctx.userId).coins);
  var state = Utils.clone(before.state) || {};
  state.inventory = InventoryService.normalize(state.inventory);
  state.inventory.shield = 0;
  state.coins = 0;
  try {
    ProgressService.updateRow_(ctx.userId, { state: state });
    CrudService.update(Config.SHEETS.USERS, ctx.userId, { coins: 100 });
    var bought = InventoryService.buy(ctx.userId, 'shield', 2);
    assert_(Array.isArray(bought), 'retorno legado continua sendo uma lista');
    assertEqual_(bought.filter(function (item) { return item.id === 'shield'; })[0].quantity,
                 2, 'itens creditados pela loja');
    assertEqual_(Utils.toInt(UserService.getById(ctx.userId).coins),
                 100 - ShopService.quote('shield', 2).total, 'debito no saldo do usuario');
    state.inventory.shield = 2;
    assertEqual_(JSON.stringify(ProgressService.getProgress(ctx.userId).state),
                 JSON.stringify(state), 'demais campos do progresso preservados');

    state.coins = 9999;
    ProgressService.updateRow_(ctx.userId, { state: state });
    CrudService.update(Config.SHEETS.USERS, ctx.userId, { coins: 0 });
    var rejected = false;
    try {
      InventoryService.buy(ctx.userId, 'shield', 1);
    } catch (err) {
      rejected = err instanceof AppError && err.code === Errors.CODES.VALIDATION;
    }
    assert_(rejected, 'saldo legado nao autoriza compra sem moedas do usuario');
    assertEqual_(Utils.toInt(UserService.getById(ctx.userId).coins), 0,
                 'rejeicao preserva saldo');
    assertEqual_(JSON.stringify(ProgressService.getProgress(ctx.userId).state),
                 JSON.stringify(state), 'rejeicao preserva progresso');
  } finally {
    ProgressService.updateRow_(ctx.userId, { state: before.state });
    CrudService.update(Config.SHEETS.USERS, ctx.userId, { coins: originalBalance });
  }
}

/** @param {!Object} ctx */
function test_inventoryLastUnit_(ctx) {
  var before = ProgressService.getProgress(ctx.userId);
  var state = Utils.clone(before.state) || {};
  state.inventory = InventoryService.normalize(state.inventory);
  state.inventory.shield = 1;
  try {
    ProgressService.updateRow_(ctx.userId, { state: state });
    var used = assertSuccess_(api_useItem(ctx.token, 'shield', 1), 'consumo da ultima unidade');
    assertEqual_(used.filter(function (item) { return item.id === 'shield'; })[0].quantity,
                 0, 'ultima unidade descontada');
    assertFailure_(api_useItem(ctx.token, 'shield', 1), Errors.CODES.VALIDATION,
                   'segundo consumo sem estoque');
    var after = ProgressService.getProgress(ctx.userId).state;
    state.inventory.shield = 0;
    assertEqual_(JSON.stringify(after), JSON.stringify(state),
                 'consumo preserva os demais campos do progresso');
    var granted = InventoryService.grant(ctx.userId, 'shield', 1);
    assertEqual_(granted.filter(function (item) { return item.id === 'shield'; })[0].quantity,
                 1, 'reposicao apos consumo rejeitado');
  } finally {
    ProgressService.updateRow_(ctx.userId, { state: before.state });
  }
}

/** @param {!Object} ctx */
function test_inventoryQuantity_(ctx) {
  var before = ProgressService.getProgress(ctx.userId);
  var originalBalance = Utils.toInt(UserService.getById(ctx.userId).coins);
  var state = Utils.clone(before.state) || {};
  state.inventory = InventoryService.normalize(state.inventory);
  state.inventory.shield = 2;
  try {
    ProgressService.updateRow_(ctx.userId, { state: state });
    UserService.addCoins(ctx.userId, 100);
    [0, false, true, '', null, -1, 1.5, 'invalida', [1], ['2'], {}].forEach(function (quantity) {
      assertFailure_(api_buyItem(ctx.token, 'shield', quantity),
                     Errors.CODES.VALIDATION, 'compra com quantidade ' + JSON.stringify(quantity));
      assertFailure_(api_useItem(ctx.token, 'shield', quantity),
                     Errors.CODES.VALIDATION, 'uso com quantidade ' + JSON.stringify(quantity));
    });
    assertEqual_(Utils.toInt(UserService.getById(ctx.userId).coins), originalBalance + 100,
                 'quantidades invalidas preservam moedas');
    assertEqual_(InventoryService.normalize(
        ProgressService.getProgress(ctx.userId).state.inventory).shield, 2,
        'quantidades invalidas preservam itens');

    var purchase = assertSuccess_(api_buyItem(ctx.token, 'shield'), 'compra sem quantidade');
    assertEqual_(purchase.quote.quantity, 1, 'compra omitida usa uma unidade');
    assertEqual_(purchase.balance, originalBalance + 70, 'compra omitida debita uma unidade');
    var inventory = assertSuccess_(api_useItem(ctx.token, 'shield'), 'uso sem quantidade');
    assertEqual_(inventory.filter(function (item) { return item.id === 'shield'; })[0].quantity,
                 2, 'uso omitido consome uma unidade');
    var numericText = assertSuccess_(api_buyItem(ctx.token, 'shield', '1'),
                                    'compra com texto numerico');
    assertEqual_(numericText.quote.quantity, 1, 'texto numerico convertido');
    var usedText = assertSuccess_(api_useItem(ctx.token, 'shield', '1'),
                                 'uso com texto numerico');
    assertEqual_(usedText.filter(function (item) { return item.id === 'shield'; })[0].quantity,
                 2, 'uso com texto numerico preservado');
  } finally {
    ProgressService.updateRow_(ctx.userId, { state: before.state });
    CrudService.update(Config.SHEETS.USERS, ctx.userId, { coins: originalBalance });
  }
}

/** @param {!Object} ctx */
function test_purchaseCapacity_(ctx) {
  var before = ProgressService.getProgress(ctx.userId);
  var state = Utils.clone(before.state) || {};
  state.inventory = InventoryService.normalize(state.inventory);
  state.inventory.shield = 98;
  ProgressService.updateRow_(ctx.userId, { state: state });
  var originalBalance = Utils.toInt(UserService.getById(ctx.userId).coins);
  UserService.addCoins(ctx.userId, 100);
  try {
    assertFailure_(api_buyItem(ctx.token, 'shield', 2),
                   Errors.CODES.VALIDATION, 'compra excede capacidade');
    assertEqual_(Utils.toInt(UserService.getById(ctx.userId).coins), originalBalance + 100,
                 'compra rejeitada nao debita moedas');
    var quantities = InventoryService.normalize(
        ProgressService.getProgress(ctx.userId).state.inventory);
    assertEqual_(quantities.shield, 98, 'compra rejeitada nao altera inventario');

    var accepted = assertSuccess_(api_buyItem(ctx.token, 'shield', 1),
                                  'compra no limite exato');
    assertEqual_(accepted.balance, originalBalance + 70, 'debito no limite exato');
    assertEqual_(accepted.inventory.filter(function (item) {
      return item.id === 'shield';
    })[0].quantity, 99, 'capacidade maxima respeitada');
  } finally {
    ProgressService.updateRow_(ctx.userId, { state: before.state });
    CrudService.update(Config.SHEETS.USERS, ctx.userId, { coins: originalBalance });
  }
}

/** @param {!Object} ctx */
function test_adminDashboard_(ctx) {
  assertFailure_(api_adminGetDashboard(ctx.token),
                 Errors.CODES.FORBIDDEN, 'jogador comum no painel');

  CrudService.update(Config.SHEETS.USERS, ctx.userId, { role: 'admin' });
  try {
    var dashboard = assertSuccess_(api_adminGetDashboard(ctx.token), 'painel admin');
    assert_(dashboard.totalUsers >= 1, 'painel deve contar usuarios');
    assert_(dashboard.totalGames >= 1, 'painel deve contar partidas');
  } finally {
    CrudService.update(Config.SHEETS.USERS, ctx.userId, { role: 'player' });
  }
}

/** @param {!Object} ctx */
function test_createAdmin_(ctx) {
  var rejected = false;
  try {
    createAdminUser();
  } catch (err) {
    rejected = err instanceof AppError && err.code === Errors.CODES.VALIDATION;
  }
  assert_(rejected, 'createAdminUser sem credenciais deve falhar');

  var username = 'test_admin_' + Utilities.getUuid().substring(0, 6);
  var admin = createAdminUser(username, 'senhaAdmin1234', '');
  try {
    assertEqual_(admin.role, 'admin', 'papel do admin criado');
    var stored = UserService.getById(admin.id);
    assert_(stored.password === 'senhaAdmin1234',
            'senha do admin deve ser armazenada em texto plano');
  } finally {
    UserService.deleteUser(admin.id);
  }
}

/** @param {!Object} ctx */
function test_logout_(ctx) {
  assertSuccess_(api_logout(ctx.token), 'logout');
  var check = assertSuccess_(api_validateSession(ctx.token), 'validar sessao');
  assertEqual_(check.valid, false, 'sessao deve estar invalida apos logout');
}

/**
 * Remove o usuario de teste e seus dados.
 * @param {!Object} ctx
 * @private
 */
function cleanupTestUser_(ctx) {
  try {
    if (ctx.token) SessionManager.destroySession(ctx.token);
    var user = ctx.userId ? CrudService.findById(Config.SHEETS.USERS, ctx.userId)
                          : UserService.findByUsername(ctx.username);
    if (user) UserService.deleteUser(user.id);
    LeaderboardService.invalidateCache();
  } catch (err) {
    console.warn('Limpeza do teste falhou: ' + (err && err.message));
  }
}
