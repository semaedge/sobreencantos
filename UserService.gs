/**
 * UserService.gs
 * CRUD e consultas de usuario. Nunca devolve a coluna de senha para fora
 * do backend: use toPublicProfile() em tudo que chega ao frontend.
 */
var UserService = {

  EDITABLE_FIELDS: ['email'],

  /**
   * @param {string} userId
   * @return {!Object} Registro completo (inclui senha - uso interno).
   */
  getById: function (userId) {
    var user = CrudService.findById(Config.SHEETS.USERS, userId);
    if (!user) throw Errors.notFound('Usuario nao encontrado.');
    return user;
  },

  /**
   * @param {string} username
   * @return {?Object} Registro completo ou null.
   */
  findByUsername: function (username) {
    return CrudService.findOne(Config.SHEETS.USERS,
                               { username: Utils.normalizeUsername(username) });
  },

  /**
   * Perfil do usuario da sessao, com progresso.
   * @param {string} token
   * @return {!Object}
   */
  getProfile: function (token) {
    var session = SessionManager.requireSession(token);
    var user = UserService.getById(session.userId);
    var profile = UserService.toPublicProfile(user);
    profile.progress = ProgressService.getProgress(user.id);
    profile.bestScore = ScoreService.getBestScore(user.id);
    return profile;
  },

  /**
   * Atualiza campos editaveis do perfil (hoje apenas e-mail).
   * @param {string} token
   * @param {!Object} changes
   * @return {!Object} Perfil publico atualizado.
   */
  updateProfile: function (token, changes) {
    var session = SessionManager.requireSession(token);
    UserService.requireOnlyFields_(changes, UserService.EDITABLE_FIELDS);
    var patch = {};

    if (changes && changes.email !== undefined) {
      if (changes.email !== null && typeof changes.email !== 'string') {
        throw Errors.validation('E-mail invalido.');
      }
      var mail = Utils.str(changes.email).toLowerCase();
      if (mail.length > 254 || (mail && !AuthService.isValidEmail_(mail))) {
        throw Errors.validation('E-mail invalido.');
      }
      patch.email = mail;
    }

    if (Object.keys(patch).length === 0) {
      throw Errors.validation('Nenhum campo editavel foi informado.');
    }

    var updated = CrudService.update(Config.SHEETS.USERS, session.userId, patch);
    
    AppLogger.info('Perfil atualizado.', {
      userId: session.userId,
      fields: Object.keys(patch)
    });
    
    return UserService.toPublicProfile(updated);
  },

  /**
   * Credita ou debita moedas. Rejeita saldo negativo.
   * @param {string} userId
   * @param {number} delta
   * @return {number} Novo saldo.
   */
  addCoins: function (userId, delta) {
    var numericDelta = Number(delta);
    if (!isFinite(numericDelta) || Math.floor(numericDelta) !== numericDelta ||
        numericDelta === 0) {
      throw Errors.validation('A variacao de moedas deve ser um inteiro diferente de zero.');
    }
    return SheetManager.withLock(function () {
      var user = UserService.getById(userId);
      var balance = Utils.toInt(user.coins) + numericDelta;
      
      if (balance < 0) {
        AppLogger.warn('Tentativa de criar saldo negativo de moedas.', {
          userId: userId,
          currentBalance: Utils.toInt(user.coins),
          delta: numericDelta,
          resultingBalance: balance,
          severity: 'security'
        });
        throw Errors.validation('Saldo de moedas insuficiente.');
      }
      
      CrudService.update(Config.SHEETS.USERS, userId, { coins: balance });
      
      AppLogger.info('Saldo de moedas atualizado.', {
        userId: userId,
        delta: numericDelta,
        newBalance: balance
      });
      
      return balance;
    });
  },

  /**
   * Remove o registro do usuario e seus dados derivados.
   * @param {string} userId
   * @return {boolean}
   */
  deleteUser: function (userId) {
    SessionManager.destroyUserSessions(userId);
    CrudService.findBy(Config.SHEETS.PROGRESS, { userId: userId })
        .forEach(function (row) { CrudService.remove(Config.SHEETS.PROGRESS, row.id); });
    CrudService.findBy(Config.SHEETS.SCORES, { userId: userId })
        .forEach(function (row) { CrudService.remove(Config.SHEETS.SCORES, row.id); });
    CrudService.findBy(Config.SHEETS.LEARNING_JOURNALS, { userId: userId })
        .forEach(function (row) { CrudService.remove(Config.SHEETS.LEARNING_JOURNALS, row.id); });
    CrudService.findBy(Config.SHEETS.SETTINGS, { userId: userId })
        .forEach(function (row) { CrudService.remove(Config.SHEETS.SETTINGS, row.id); });

    var removed = CrudService.remove(Config.SHEETS.USERS, userId);
    AppLogger.info('Usuario removido.', { userId: userId, removed: removed });
    return removed;
  },

  /**
   * Projecao segura de um registro de usuario.
   * @param {!Object} user
   * @return {!Object}
   */
  toPublicProfile: function (user) {
    return {
      id: user.id,
      username: user.username,
      email: Utils.str(user.email),
      role: user.role || Config.AUTH.DEFAULT_ROLE,
      coins: Utils.toInt(user.coins),
      createdAt: user.createdAt,
      lastLoginAt: Utils.str(user.lastLoginAt)
    };
  },

  /**
   * Rejeita atualizacoes silenciosas de campos que o perfil nao permite editar.
   * @param {*} changes
   * @param {!Array<string>} allowed
   * @private
   */
  requireOnlyFields_: function (changes, allowed) {
    if (!changes || Object.prototype.toString.call(changes) !== '[object Object]') {
      throw Errors.validation('Alteracoes de perfil invalidas.');
    }
    var unknown = Object.keys(changes).filter(function (key) {
      return allowed.indexOf(key) === -1;
    });
    if (unknown.length) {
      AppLogger.warn('Tentativa de modificar campo não editável do perfil.', {
        attemptedFields: unknown,
        severity: 'security'
      });
      throw Errors.validation('Campo de perfil nao editavel: ' + unknown[0] + '.');
    }
  }
};
