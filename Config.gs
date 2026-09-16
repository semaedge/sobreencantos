/**
 * Config.gs
 * Configuracoes globais do jogo Sobre Encantos.
 *
 * O ID da planilha vem das Propriedades do Script (chave SPREADSHEETS_ID).
 * Na ausencia dela, usa a planilha vinculada ao projeto (container-bound).
 */
var Config = {

  APP_NAME: 'Sobre Encantos',

  /** Chave nas Propriedades do Script que guarda o ID da planilha de dados. */
  SPREADSHEET_ID_KEY: 'SPREADSHEETS_ID',

  /** Nomes das abas usadas pelo backend. */
  SHEETS: {
    USERS: 'Users',
    SESSIONS: 'Sessions',
    PROGRESS: 'Progress',
    SCORES: 'Scores',
    LEARNING_JOURNALS: 'LearningJournals',
    SETTINGS: 'Settings',
    LOGS: 'Logs'
  },

  /**
   * Esquema de cada aba. `headers` define a ordem das colunas (linha 1) e
   * `jsonFields` as colunas serializadas como JSON pelo CrudService.
   */
  SCHEMAS: {
    Users: {
      headers: ['id', 'username', 'password', 'email', 'role', 'coins',
                'createdAt', 'updatedAt', 'lastLoginAt'],
      jsonFields: []
    },
    Sessions: {
      headers: ['id', 'userId', 'tokenHash', 'username', 'role', 'expiresAt',
                'createdAt', 'updatedAt'],
      jsonFields: []
    },
    Progress: {
      headers: ['id', 'userId', 'currentLevel', 'maxLevelReached', 'totalDistance',
                'state', 'createdAt', 'updatedAt'],
      jsonFields: ['state']
    },
    Scores: {
      headers: ['id', 'userId', 'username', 'level', 'score', 'distance', 'coins',
                'createdAt', 'updatedAt'],
      jsonFields: []
    },
    LearningJournals: {
      headers: ['id', 'userId', 'gameId', 'levelId', 'city', 'prediction',
                'causalPair', 'mechanism', 'evidence', 'revision', 'completed',
                'score', 'completeness', 'createdAt', 'updatedAt'],
      jsonFields: []
    },
    Settings: {
      headers: ['id', 'userId', 'settings', 'createdAt', 'updatedAt'],
      jsonFields: ['settings']
    },
    Logs: {
      headers: ['timestamp', 'level', 'message', 'context'],
      jsonFields: ['context']
    }
  },

  /** Sessao de usuario: validade do token, em segundos (6 horas). */
  SESSION_TTL_SECONDS: 6 * 60 * 60,

  /** Limite de sessoes simultaneas por conta. */
  MAX_SESSIONS_PER_USER: 5,

  /** Propriedades temporarias usadas por createAdminUser(). */
  ADMIN_BOOTSTRAP_KEYS: {
    USERNAME: 'BOOTSTRAP_ADMIN_USERNAME',
    PASSWORD: 'BOOTSTRAP_ADMIN_PASSWORD',
    EMAIL: 'BOOTSTRAP_ADMIN_EMAIL'
  },

  /** Nivel minimo de log: DEBUG | INFO | WARN | ERROR. */
  LOG_LEVEL: 'INFO',

  /** Grava logs tambem na aba Logs (alem do Stackdriver). */
  LOG_TO_SHEET: false,

  /**
   * Paginas HTML que o doGet aceita servir. Index e o jogo; Debug e a pagina
   * de verificacao da API, em ?page=Debug.
   */
  ALLOWED_PAGES: ['Index', 'Debug'],

  /** Configuracoes de conta. */
  AUTH: {
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 20,
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    PASSWORD_HASH_ITERATIONS: 2000,
    DEFAULT_ROLE: 'player',
    STARTING_COINS: 0
  },

  /**
   * ID da planilha de dados.
   * @return {string}
   */
  getSpreadsheetId: function () {
    var id = PropertiesService.getScriptProperties().getProperty(Config.SPREADSHEET_ID_KEY);
    if (id) return id;

    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active.getId();

    throw new Error(
      'SPREADSHEETS_ID nao configurado. Rode setup() ou defina a propriedade do script.');
  },

  /**
   * Esquema de uma aba.
   * @param {string} sheetName
   * @return {{headers: !Array<string>, jsonFields: !Array<string>}}
   */
  getSchema: function (sheetName) {
    var schema = Config.SCHEMAS[sheetName];
    if (!schema) throw new Error('Aba sem esquema definido: ' + sheetName);
    return schema;
  }
};
