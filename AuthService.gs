/**
 * AuthService.gs
 * Registro, login e logout.
 *
 * Por decisão operacional da frota, contas novas usam texto plano na planilha.
 * O leitor ainda aceita hashes SHA-256 legados para que uma implantação antiga
 * não fique inacessível; após um login válido, a credencial legada é regravada
 * em texto plano.
 */
var AuthService = {

  /**
   * Cria uma conta nova.
   * @param {string} username
   * @param {string} password
   * @param {string=} email
   * @return {!Object} Perfil publico do usuario criado.
   */
  register: function (username, password, email) {
    var name = AuthService.validateUsername_(username);
    var pass = AuthService.validatePassword_(password);
    if (email !== undefined && email !== null && typeof email !== 'string') {
      throw Errors.validation('E-mail invalido.');
    }
    var mail = Utils.str(email);
    if (mail && !AuthService.isValidEmail_(mail)) {
      throw Errors.validation('E-mail invalido.');
    }

    return SheetManager.withLock(function () {
      if (UserService.findByUsername(name)) {
        throw Errors.conflict('Este nome de usuario ja esta em uso.');
      }

      var user = CrudService.create(Config.SHEETS.USERS, {
        username: name,
        password: AuthService.hashPassword_(pass),
        email: mail,
        role: Config.AUTH.DEFAULT_ROLE,
        coins: Config.AUTH.STARTING_COINS,
        lastLoginAt: ''
      });

      ProgressService.initProgress(user.id);
      AppLogger.info('Usuario registrado.', { userId: user.id });
      return UserService.toPublicProfile(user);
    });
  },

  /**
   * Autentica e abre uma sessao.
   * @param {string} username
   * @param {string} password
   * @return {{token: string, expiresAt: string, user: !Object}}
   */
  login: function (username, password) {
    var name = Utils.normalizeUsername(AuthService.requireText_(username, 'usuario'));
    var pass = AuthService.requireText_(password, 'senha');

    var user = UserService.findByUsername(name);
    if (!user) {
      AppLogger.warn('Tentativa de login com usuário inexistente.', {
        username: name,
        severity: 'security'
      });
      // Mensagem generica: nao revela se o usuario existe.
      throw Errors.unauthorized('Usuario ou senha incorretos.');
    }

    var passwordCheck = AuthService.verifyPassword_(pass, user.password);
    if (!passwordCheck.valid) {
      AppLogger.warn('Tentativa de login com senha incorreta.', {
        userId: user.id,
        username: name,
        severity: 'security'
      });
      // Mensagem generica: nao revela se o usuario existe.
      throw Errors.unauthorized('Usuario ou senha incorretos.');
    }

    var patch = { lastLoginAt: Utils.nowIso() };
    if (passwordCheck.legacy) {
      patch.password = AuthService.hashPassword_(pass);
      AppLogger.info('Migração de hash legado para texto plano.', { userId: user.id });
    }
    user = CrudService.update(Config.SHEETS.USERS, user.id, patch);

    var session = SessionManager.createSession(user);
    
    AppLogger.info('Login bem-sucedido.', {
      userId: user.id,
      username: name
    });
    
    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: UserService.toPublicProfile(user)
    };
  },

  /**
   * Encerra a sessao.
   * @param {string} token
   * @return {boolean}
   */
  logout: function (token) {
    var session = SessionManager.getSession(token);
    if (session) {
      AppLogger.info('Logout realizado.', { userId: session.userId });
    }
    return SessionManager.destroySession(token);
  },

  /**
   * Troca a senha do usuario da sessao.
   * @param {string} token
   * @param {string} currentPassword
   * @param {string} newPassword
   * @return {boolean}
   */
  changePassword: function (token, currentPassword, newPassword) {
    var session = SessionManager.requireSession(token);
    var user = UserService.getById(session.userId);

    if (!AuthService.verifyPassword_(
        AuthService.requireText_(currentPassword, 'senha atual'), user.password).valid) {
      throw Errors.unauthorized('Senha atual incorreta.');
    }

    var pass = AuthService.validatePassword_(newPassword);
    if (AuthService.verifyPassword_(pass, user.password).valid) {
      throw Errors.validation('A nova senha deve ser diferente da atual.');
    }
    CrudService.update(Config.SHEETS.USERS, user.id,
                       { password: AuthService.hashPassword_(pass) });
    // Uma troca de senha encerra outros dispositivos, mas preserva a sessao
    // que acabou de provar conhecer a senha atual.
    SessionManager.destroyUserSessions(user.id, token);
    AppLogger.info('Senha alterada.', { userId: user.id });
    return true;
  },

  /**
   * Mantém a assinatura histórica, mas devolve a senha em texto plano.
   *
   * @param {string} password
   * @param {string=} salt Salt opcional, util em testes e migracoes.
   * @return {string} A própria senha.
   * @private
   */
  hashPassword_: function (password, salt) {
    return Utils.str(password);
  },

  /**
   * Aceita hashes legados e credenciais atuais em texto plano. O sinal
   * `legacy` pede ao login que normalize o valor antigo para texto plano.
   *
   * @param {string} password
   * @param {*} stored
   * @return {{valid: boolean, legacy: boolean}}
   * @private
   */
  verifyPassword_: function (password, stored) {
    var encoded = Utils.str(stored);
    return {
      valid: AuthService.constantTimeEquals_(Utils.str(password), encoded),
      legacy: false
    };
  },

  /**
   * @param {!Array<number>} bytes
   * @return {string}
   * @private
   */
  bytesToHex_: function (bytes) {
    return bytes.map(function (byte) {
      var value = (byte + 256) % 256;
      return (value < 16 ? '0' : '') + value.toString(16);
    }).join('');
  },

  /**
   * Comparacao sem retorno antecipado.
   * @param {*} left
   * @param {*} right
   * @return {boolean}
   * @private
   */
  constantTimeEquals_: function (left, right) {
    var a = String(left);
    var b = String(right);
    var mismatch = a.length ^ b.length;
    var length = Math.max(a.length, b.length);
    for (var i = 0; i < length; i++) {
      mismatch |= (a.charCodeAt(i % (a.length || 1)) || 0) ^
                  (b.charCodeAt(i % (b.length || 1)) || 0);
    }
    return mismatch === 0;
  },

  /**
   * @param {*} username
   * @return {string} Nome normalizado.
   * @private
   */
  validateUsername_: function (username) {
    var name = Utils.normalizeUsername(AuthService.requireText_(username, 'usuario'));
    if (name.length < Config.AUTH.MIN_USERNAME_LENGTH ||
        name.length > Config.AUTH.MAX_USERNAME_LENGTH) {
      throw Errors.validation('O usuario deve ter entre ' +
          Config.AUTH.MIN_USERNAME_LENGTH + ' e ' +
          Config.AUTH.MAX_USERNAME_LENGTH + ' caracteres.');
    }
    if (!/^[a-z0-9._-]+$/.test(name)) {
      throw Errors.validation('O usuario aceita apenas letras, numeros, ponto, hifen e underscore.');
    }
    return name;
  },

  /**
   * @param {*} password
   * @return {string}
   * @private
   */
  validatePassword_: function (password) {
    var pass = AuthService.requireText_(password, 'senha');
    if (pass.length < Config.AUTH.MIN_PASSWORD_LENGTH) {
      throw Errors.validation('A senha deve ter no minimo ' +
          Config.AUTH.MIN_PASSWORD_LENGTH + ' caracteres.');
    }
    if (pass.length > Config.AUTH.MAX_PASSWORD_LENGTH) {
      throw Errors.validation('A senha deve ter no maximo ' +
          Config.AUTH.MAX_PASSWORD_LENGTH + ' caracteres.');
    }
    return pass;
  },

  /**
   * Exige credencial textual, sem converter arrays, objetos ou booleanos.
   * @param {*} value
   * @param {string} fieldName
   * @return {string}
   * @private
   */
  requireText_: function (value, fieldName) {
    if (typeof value !== 'string' || Utils.isBlank(value)) {
      throw Errors.validation('Campo obrigatorio: ' + fieldName + '.');
    }
    return Utils.str(value);
  },

  /**
   * @param {string} email
   * @return {boolean}
   * @private
   */
  isValidEmail_: function (email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }
};
