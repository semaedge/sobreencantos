/**
 * Code.gs
 * Ponto de entrada do web app e rotina de instalacao.
 */

/**
 * Serve a interface do jogo.
 * @param {!Object} e Evento do Apps Script (parametros da URL).
 * @return {!HtmlOutput}
 */
function doGet(e) {
  var requested = (e && e.parameter && e.parameter.page) || 'Index';
  var page = Config.ALLOWED_PAGES.indexOf(requested) !== -1 ? requested : 'Index';

  return HtmlService.createTemplateFromFile(page)
      .evaluate()
      .setTitle(Config.APP_NAME)
      // Sem user-scalable=no: bloquear o zoom quebra a leitura de quem
      // precisa ampliar. Mesmo viewport usado no resto da frota.
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Inclui outro arquivo HTML no template. Uso: <?!= include('Stylesheet') ?>
 * @param {string} filename
 * @return {string}
 */
function include(filename) {
  // Avalia parciais para permitir componentes compostos, como GameScreen -> GameScene.
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

function includeInlineData(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent().replace(/\s+/g, '');
}

/**
 * Instalacao do projeto: cria (ou reaproveita) a planilha de dados, grava o
 * SPREADSHEETS_ID nas propriedades do script e monta todas as abas.
 *
 * Rode uma vez, manualmente, no editor do Apps Script.
 * @return {!Object} Resumo da instalacao.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty(Config.SPREADSHEET_ID_KEY);

  if (!spreadsheetId) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    var spreadsheet = active || SpreadsheetApp.create(Config.APP_NAME + ' - Dados');
    spreadsheetId = spreadsheet.getId();
    props.setProperty(Config.SPREADSHEET_ID_KEY, spreadsheetId);
  }

  var sheets = SheetManager.ensureAllSheets();
  var summary = {
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: SpreadsheetApp.openById(spreadsheetId).getUrl(),
    sheets: sheets,
    users: CrudService.count(Config.SHEETS.USERS)
  };

  Logger.log('Setup concluido: ' + JSON.stringify(summary));
  return summary;
}

/**
 * Cria o primeiro administrador. Aceita argumentos para testes e automacao; no
 * editor do Apps Script, leia as credenciais das Propriedades do Script
 * BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD e BOOTSTRAP_ADMIN_EMAIL.
 * A propriedade com a senha e apagada depois da criacao bem-sucedida.
 * @param {string} username
 * @param {string} password
 * @param {string=} email
 * @return {!Object} Perfil publico do admin.
 */
function createAdminUser(username, password, email) {
  var props = PropertiesService.getScriptProperties();
  var keys = Config.ADMIN_BOOTSTRAP_KEYS;
  var name = Errors.requireField(
      username || props.getProperty(keys.USERNAME), 'usuario administrador');
  var pass = Errors.requireField(
      password || props.getProperty(keys.PASSWORD), 'senha do administrador');
  var mail = email !== undefined ? email : props.getProperty(keys.EMAIL);
  var existing = UserService.findByUsername(name);
  if (existing) {
    if ((existing.role || Config.AUTH.DEFAULT_ROLE) !== 'admin') {
      throw Errors.conflict('Ja existe uma conta comum com este nome.');
    }
    props.deleteProperty(keys.PASSWORD);
    Logger.log('Admin ja existe: ' + existing.id);
    return UserService.toPublicProfile(existing);
  }

  var profile = AuthService.register(name, pass, mail);
  CrudService.update(Config.SHEETS.USERS, profile.id, { role: 'admin' });
  props.deleteProperty(keys.PASSWORD);
  Logger.log('Admin criado: ' + profile.id + '.');
  profile.role = 'admin';
  return profile;
}

/**
 * Verificacao rapida de saude do backend. Util apos o deploy.
 * @return {!Object}
 */
function healthCheck() {
  var result = Errors.wrap('healthCheck', function () {
    return {
      app: Config.APP_NAME,
      spreadsheetId: Config.getSpreadsheetId(),
      sheets: Object.keys(Config.SHEETS).map(function (key) {
        var name = Config.SHEETS[key];
        return { name: name, rows: CrudService.count(name) };
      }),
      levels: GameConstants.LEVELS.length,
      timestamp: Utils.nowIso()
    };
  });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
