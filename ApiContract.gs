/**
 * ApiContract.gs
 * Contrato unico entre backend e frontend.
 *
 * Antes existiam duas listas da mesma coisa: as funcoes api_* aqui e um objeto
 * Api escrito a mao em JavaScript.html, com os codigos de erro repetidos como
 * literais nos dois lados. Duas listas que precisam concordar sempre acabam
 * divergindo em silencio.
 *
 * Agora esta e a lista. O cliente recebe o contrato em api_bootstrap e monta os
 * proprios metodos a partir dele - inclusive a decisao de anexar o token, que
 * deixa de ser responsabilidade de cada ponto de chamada.
 *
 * Ao mexer aqui, suba VERSION e o mesmo valor em JavaScript.html
 * (CONTRATO_ESPERADO). A auditoria do frontend compara os dois e reclama se
 * ficarem diferentes.
 */
var ApiContract = {

  /** Versao do contrato. Mudou a forma de alguma resposta? Suba. */
  VERSION: '2.0.0',

  /**
   * Como cada operacao trata o token de sessao:
   *   'obrigatorio' - o cliente anexa o token; o backend exige sessao valida
   *   'opcional'    - o cliente anexa se tiver; o backend aceita ausente
   *   'nenhum'      - operacao publica
   *   'explicito'   - quem chama passa o token na mao, de proposito
   */
  OPERACOES: [
    { fn: 'api_bootstrap',          cliente: 'bootstrap',        token: 'opcional' },

    { fn: 'api_register',           cliente: 'registrar',        token: 'nenhum' },
    { fn: 'api_login',              cliente: 'entrar',           token: 'nenhum' },
    { fn: 'api_logout',             cliente: 'sair',             token: 'obrigatorio' },
    { fn: 'api_validateSession',    cliente: 'validarSessao',    token: 'explicito' },
    { fn: 'api_changePassword',     cliente: 'trocarSenha',      token: 'obrigatorio' },

    { fn: 'api_getProfile',         cliente: 'perfil',           token: 'obrigatorio' },
    { fn: 'api_updateProfile',      cliente: 'atualizarPerfil',  token: 'obrigatorio' },

    { fn: 'api_getGameData',        cliente: 'constantes',       token: 'nenhum' },
    { fn: 'api_getLevelSelection',  cliente: 'niveis',           token: 'obrigatorio' },

    { fn: 'api_startGame',          cliente: 'iniciarPartida',   token: 'obrigatorio' },
    { fn: 'api_endGame',            cliente: 'encerrarPartida',  token: 'obrigatorio' },
    { fn: 'api_abandonGame',        cliente: 'abandonarPartida', token: 'obrigatorio' },

    { fn: 'api_getProgress',        cliente: 'progresso',        token: 'obrigatorio' },
    { fn: 'api_saveProgress',       cliente: 'salvarProgresso',  token: 'obrigatorio' },

    { fn: 'api_getLeaderboard',     cliente: 'ranking',          token: 'nenhum' },
    { fn: 'api_getRankingVizinhanca', cliente: 'rankingVizinhanca', token: 'obrigatorio' },
    { fn: 'api_getMyStats',         cliente: 'estatisticas',     token: 'obrigatorio' },

    { fn: 'api_getSettings',        cliente: 'lerConfig',        token: 'obrigatorio' },
    { fn: 'api_saveSettings',       cliente: 'salvarConfig',     token: 'obrigatorio' },

    // Inventario
    { fn: 'api_getInventory',       cliente: 'inventario',       token: 'obrigatorio' },
    { fn: 'api_useItem',            cliente: 'usarItem',         token: 'obrigatorio' },
    { fn: 'api_buyItem',            cliente: 'comprarItem',      token: 'obrigatorio' },

    // Conquistas
    { fn: 'api_getAchievements',    cliente: 'conquistas',       token: 'obrigatorio' },

    // Evidencia Pedagogica
    { fn: 'api_saveLearningDraft',  cliente: 'salvarRascunhoPedagogico', token: 'obrigatorio' },
    { fn: 'api_getLearningDraft',   cliente: 'lerRascunhoPedagogico',    token: 'obrigatorio' },
    { fn: 'api_getLearningHistory', cliente: 'historicoAprendizagem',    token: 'obrigatorio' },

    // Experiencia Narrativa
    { fn: 'api_getExperienceChapter', cliente: 'capituloNarrativa',   token: 'obrigatorio' },
    { fn: 'api_makeExperienceDecision', cliente: 'decisaoNarrativa', token: 'obrigatorio' },
    { fn: 'api_getExperienceWorkflow', cliente: 'workflowNarrativa', token: 'obrigatorio' },
    { fn: 'api_getExperienceEndgame', cliente: 'desfechoNarrativa',  token: 'obrigatorio' },

    // Administracao
    { fn: 'api_adminGetDashboard',  cliente: 'painelAdmin',      token: 'obrigatorio',
      papel: 'admin' }
  ],

  /**
   * Contrato no formato que o cliente consome.
   * @return {!Object}
   */
  paraCliente: function () {
    return {
      versao: ApiContract.VERSION,
      codigos: Errors.CODES,
      operacoes: ApiContract.OPERACOES.map(function (op) {
        return { fn: op.fn, cliente: op.cliente, token: op.token };
      })
    };
  },

  /**
   * Nomes de funcao declarados no contrato que nao existem como funcao global.
   * Tests.gs usa isto: contrato que promete o que nao existe e pior que
   * contrato nenhum.
   * @return {!Array<string>}
   */
  operacoesAusentes: function () {
    return ApiContract.OPERACOES
        .filter(function (op) {
          return typeof globalThis[op.fn] !== 'function';
        })
        .map(function (op) { return op.fn; });
  }
};
