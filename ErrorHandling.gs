/**
 * ErrorHandling.gs
 * Erros de aplicacao e o envelope de resposta usado pelo frontend.
 *
 * Toda funcao exposta via google.script.run devolve:
 *   { ok: true,  data: <payload> }
 *   { ok: false, error: { code: <string>, message: <string> } }
 */

/**
 * Erro de negocio com codigo estavel para o frontend.
 * @param {string} code
 * @param {string} message
 * @constructor
 * @extends {Error}
 */
function AppError(code, message) {
  this.name = 'AppError';
  this.code = code;
  this.message = message;
  this.stack = (new Error(message)).stack;
}
AppError.prototype = Object.create(Error.prototype);
AppError.prototype.constructor = AppError;

var Errors = {

  /** Codigos de erro conhecidos. */
  CODES: {
    VALIDATION: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL: 'INTERNAL_ERROR'
  },

  /** @param {string} message @return {!AppError} */
  validation: function (message) {
    return new AppError(Errors.CODES.VALIDATION, message);
  },

  /** @param {string} message @return {!AppError} */
  notFound: function (message) {
    return new AppError(Errors.CODES.NOT_FOUND, message);
  },

  /** @param {string} message @return {!AppError} */
  conflict: function (message) {
    return new AppError(Errors.CODES.CONFLICT, message);
  },

  /** @param {string} message @return {!AppError} */
  unauthorized: function (message) {
    return new AppError(Errors.CODES.UNAUTHORIZED, message);
  },

  /** @param {string} message @return {!AppError} */
  forbidden: function (message) {
    return new AppError(Errors.CODES.FORBIDDEN, message);
  },

  /**
   * Resposta de sucesso.
   * @param {*} data
   * @return {{ok: boolean, data: *}}
   */
  ok: function (data) {
    return { ok: true, data: data === undefined ? null : data };
  },

  /**
   * Resposta de falha.
   * @param {string} code
   * @param {string} message
   * @return {{ok: boolean, error: {code: string, message: string}}}
   */
  fail: function (code, message) {
    return { ok: false, error: { code: code, message: message } };
  },

  /**
   * Executa `fn` e converte o resultado (ou a excecao) no envelope de resposta.
   * Erros inesperados sao logados e devolvidos como INTERNAL_ERROR, sem expor
   * detalhes internos ao cliente.
   *
   * @param {string} operation Nome da operacao, para o log.
   * @param {function(): *} fn
   * @return {!Object} Envelope de resposta.
   */
  wrap: function (operation, fn) {
    try {
      return Errors.ok(fn());
    } catch (err) {
      if (err instanceof AppError) {
        AppLogger.warn(operation + ' rejeitado: ' + err.message, { code: err.code });
        return Errors.fail(err.code, err.message);
      }
      AppLogger.error(operation + ' falhou: ' + (err && err.message), {
        stack: err && err.stack ? String(err.stack) : null
      });
      return Errors.fail(Errors.CODES.INTERNAL, 'Erro interno. Tente novamente.');
    }
  },

  /**
   * Garante que um campo obrigatorio foi informado.
   * @param {*} value
   * @param {string} fieldName
   * @return {string} O valor aparado.
   */
  requireField: function (value, fieldName) {
    if (Utils.isBlank(value)) {
      throw Errors.validation('Campo obrigatorio: ' + fieldName + '.');
    }
    return Utils.str(value);
  }
};
