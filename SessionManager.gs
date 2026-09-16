/**
 * SessionManager.gs
 * Sessoes duraveis com token opaco. O hash do token fica na aba Sessions e o
 * CacheService e apenas uma camada de aceleracao: se o Apps Script descartar o
 * cache antes do TTL, a sessao e reconstruida a partir da planilha.
 */
var SessionManager = {

  CACHE_PREFIX: 'session:',

  /**
   * Abre uma sessao para o usuario.
   * @param {!Object} user Registro de usuario (precisa de id e username).
   * @return {{token: string, expiresAt: string}}
   */
  createSession: function (user) {
    if (!user || Utils.isBlank(user.id) || Utils.isBlank(user.username)) {
      throw new AppError(Errors.CODES.INTERNAL, 'Nao foi possivel criar a sessao.');
    }
    var token = Utils.uuid() + Utils.uuid().replace(/-/g, '');
    var expiresAt = new Date(Date.now() + Config.SESSION_TTL_SECONDS * 1000);
    var session = {
      userId: user.id,
      username: user.username,
      role: user.role || Config.AUTH.DEFAULT_ROLE,
      createdAt: Utils.nowIso(),
      expiresAt: expiresAt.toISOString()
    };

    return SheetManager.withLock(function () {
      SessionManager.pruneUserSessions_(user.id,
                                        Math.max(0, Config.MAX_SESSIONS_PER_USER - 1));
      CrudService.create(Config.SHEETS.SESSIONS, {
        userId: session.userId,
        tokenHash: SessionManager.hashToken_(token),
        username: session.username,
        role: session.role,
        expiresAt: session.expiresAt
      });
      SessionManager.cache_(token, session);
      AppLogger.info('Sessao criada.', { userId: user.id });
      return { token: token, expiresAt: session.expiresAt };
    });
  },

  /**
   * Sessao correspondente ao token.
   * @param {string} token
   * @return {?Object} null se ausente ou expirada.
   */
  getSession: function (token) {
    return SheetManager.withLock(function () {
    if (!SessionManager.isToken_(token)) return null;

    var cache = CacheService.getScriptCache();
    var raw = cache.get(SessionManager.cacheKey_(token));
    var session = null;
    if (raw) {
      try {
        session = JSON.parse(raw);
      } catch (err) {
        cache.remove(SessionManager.cacheKey_(token));
      }
    }

    if (!session) {
      var stored = CrudService.findOne(Config.SHEETS.SESSIONS, {
        tokenHash: SessionManager.hashToken_(token)
      });
      if (!stored) return null;
      session = {
        userId: stored.userId,
        username: stored.username,
        role: stored.role || Config.AUTH.DEFAULT_ROLE,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt
      };
    }

    var expiresAt = new Date(session.expiresAt).getTime();
    if (Utils.isBlank(session.userId) || Utils.isBlank(session.username) ||
        !isFinite(expiresAt) || expiresAt <= Date.now()) {
      SessionManager.destroySession(token);
      return null;
    }
    SessionManager.cache_(token, session);
    return session;
    });
  },

  /**
   * Sessao valida ou erro UNAUTHORIZED.
   * @param {string} token
   * @return {!Object}
   */
  requireSession: function (token) {
    return SheetManager.withLock(function () {
      var session = SessionManager.getSession(token);
      if (!session) throw Errors.unauthorized('Sessao invalida ou expirada.');

      // A sessao nao pode sobreviver a remocao da conta nem conservar um papel
      // administrativo que tenha sido revogado depois do login. A recarga do
      // cache permanece no mesmo lock da validacao para nao ressuscitar logout.
      var user = CrudService.findById(Config.SHEETS.USERS, session.userId);
      if (!user) {
        SessionManager.destroySession(token);
        throw Errors.unauthorized('Sessao invalida ou expirada.');
      }
      session.username = user.username;
      session.role = user.role || Config.AUTH.DEFAULT_ROLE;
      SessionManager.cache_(token, session);
      return session;
    });
  },

  /**
   * Sessao valida de um administrador, ou erro.
   * @param {string} token
   * @return {!Object}
   */
  requireAdmin: function (token) {
    var session = SessionManager.requireSession(token);
    if (session.role !== 'admin') {
      AppLogger.warn('Tentativa de acesso administrativo negado.', {
        userId: session.userId,
        role: session.role,
        severity: 'security'
      });
      throw Errors.forbidden('Acao restrita a administradores.');
    }
    return session;
  },

  /**
   * Encerra a sessao.
   * @param {string} token
   * @return {boolean}
   */
  destroySession: function (token) {
    return SheetManager.withLock(function () {
      if (!SessionManager.isToken_(token)) return false;
      var cache = CacheService.getScriptCache();
      cache.remove(SessionManager.cacheKey_(token));
      // Logout tambem encerra uma partida que ainda esteja no cache.
      cache.remove('game:' + token);
      var stored = CrudService.findBy(Config.SHEETS.SESSIONS, {
        tokenHash: SessionManager.hashToken_(token)
      });
      stored.forEach(function (row) {
        CrudService.remove(Config.SHEETS.SESSIONS, row.id);
      });
      return stored.length > 0;
    });
  },

  /**
   * Invalida todas as sessoes de uma conta, opcionalmente preservando a atual.
   * @param {string} userId
   * @param {string=} exceptToken
   * @return {number} Quantidade removida.
   */
  destroyUserSessions: function (userId, exceptToken) {
    return SheetManager.withLock(function () {
      var exceptHash = SessionManager.isToken_(exceptToken)
          ? SessionManager.hashToken_(exceptToken) : '';
      var rows = CrudService.findBy(Config.SHEETS.SESSIONS, { userId: userId });
      var removed = 0;
      rows.forEach(function (row) {
        if (exceptHash && row.tokenHash === exceptHash) return;
        CacheService.getScriptCache().remove(
            SessionManager.cacheKeyFromHash_(row.tokenHash));
        if (CrudService.remove(Config.SHEETS.SESSIONS, row.id)) removed++;
      });

      if (removed > 0) {
        AppLogger.info('Sessões do usuário encerradas.', {
          userId: userId,
          sessionsClosed: removed,
          reason: exceptHash ? 'password_change' : 'account_deletion'
        });
      }

      return removed;
      });
  },

  /**
   * Remove sessoes expiradas e limita as simultaneas de um usuario.
   * @param {string} userId
   * @param {number} keep
   * @private
   */
  pruneUserSessions_: function (userId, keep) {
    var now = Date.now();
    var active = [];
    CrudService.findBy(Config.SHEETS.SESSIONS, { userId: userId })
        .forEach(function (row) {
          var expires = new Date(row.expiresAt).getTime();
          if (!isFinite(expires) || expires <= now) {
            CacheService.getScriptCache().remove(
                SessionManager.cacheKeyFromHash_(row.tokenHash));
            CrudService.remove(Config.SHEETS.SESSIONS, row.id);
          } else {
            active.push(row);
          }
        });
    active.sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    active.slice(Math.max(0, keep)).forEach(function (row) {
      CacheService.getScriptCache().remove(
          SessionManager.cacheKeyFromHash_(row.tokenHash));
      CrudService.remove(Config.SHEETS.SESSIONS, row.id);
    });
  },

  /**
   * @param {string} token
   * @param {!Object} session
   * @private
   */
  cache_: function (token, session) {
    var remaining = Math.floor(
        (new Date(session.expiresAt).getTime() - Date.now()) / 1000);
    if (remaining <= 0) return;
    CacheService.getScriptCache().put(
        SessionManager.cacheKey_(token),
        JSON.stringify(session),
        Math.min(remaining, Config.SESSION_TTL_SECONDS));
  },

  /**
   * A planilha nunca recebe o token utilizavel, apenas seu SHA-256.
   * @param {string} token
   * @return {string}
   * @private
   */
  hashToken_: function (token) {
    if (!SessionManager.isToken_(token)) return '';
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
        .map(function (byte) {
          var value = (byte + 256) % 256;
          return (value < 16 ? '0' : '') + value.toString(16);
        }).join('');
  },

  /** @param {string} token @return {string} @private */
  cacheKey_: function (token) {
    return SessionManager.cacheKeyFromHash_(SessionManager.hashToken_(token));
  },

  /**
   * Tokens sao opacos e devem permanecer texto; conversoes silenciosas podem
   * transformar estruturas como ['token'] no mesmo valor autenticado.
   * @param {*} token
   * @return {boolean}
   * @private
   */
  isToken_: function (token) {
    return typeof token === 'string' && token.trim() !== '';
  },

  /** @param {string} tokenHash @return {string} @private */
  cacheKeyFromHash_: function (tokenHash) {
    return SessionManager.CACHE_PREFIX + tokenHash;
  }
};
