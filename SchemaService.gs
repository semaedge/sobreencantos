/**
 * SchemaService.gs
 * Acesso a planilha e as abas. Cria a aba com o cabecalho do esquema quando
 * ela ainda nao existe, para que o CrudService nunca encontre aba vazia.
 */
var SheetManager = {

  /**
   * Nomes de cabecalho encontrados em versoes antigas da planilha. O schema
   * publico continua usando os nomes canonicos em minusculas; os aliases sao
   * apenas uma ponte de migracao para que contas existentes nao desaparecam.
   */
  HEADER_ALIASES: {
    Users: {
      id: ['ID', 'Id', 'UserID', 'userId', 'userid'],
      username: ['Username', 'UserName', 'Usuario', 'usuário', 'Nome', 'nome'],
      password: ['Password', 'Pass', 'Senha', 'senha'],
      email: ['Email', 'E-mail', 'e-mail'],
      role: ['Role', 'Papel', 'perfil'],
      coins: ['Coins', 'Saldo', 'saldo'],
      createdAt: ['CreatedAt', 'CriadoEm', 'criado_em'],
      updatedAt: ['UpdatedAt', 'AtualizadoEm', 'atualizado_em'],
      lastLoginAt: ['LastLogin', 'LastLoginAt', 'UltimoLogin', 'ultimo_login']
    }
  },

  normalizeHeader_: function (value) {
    return Utils.str(value).trim().toLowerCase();
  },

  headerAliases_: function (sheetName, header) {
    var aliases = [header];
    var bySheet = SheetManager.HEADER_ALIASES[sheetName] || {};
    var configured = bySheet[header] || [];
    configured.forEach(function (alias) {
      if (aliases.indexOf(alias) === -1) aliases.push(alias);
    });
    return aliases;
  },

  findHeaderIndex_: function (headers, names, excludedIndex) {
    var keys = names.map(function (name) {
      return SheetManager.normalizeHeader_(name);
    });
    for (var i = 0; i < headers.length; i++) {
      if (i === excludedIndex) continue;
      if (keys.indexOf(SheetManager.normalizeHeader_(headers[i])) !== -1) return i;
    }
    return -1;
  },

  /** @return {!Spreadsheet} A planilha de dados do projeto. */
  getSpreadsheet: function () {
    return SpreadsheetApp.openById(Config.getSpreadsheetId());
  },

  /**
   * Aba pelo nome, criada com cabecalho se necessario.
   * @param {string} sheetName
   * @return {!Sheet}
   */
  getSheet: function (sheetName) {
    var spreadsheet = SheetManager.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      AppLogger.info('Aba criada: ' + sheetName);
    }
    SheetManager.ensureHeaders(sheet, sheetName);
    return sheet;
  },

  /**
   * Garante que a linha 1 contem o cabecalho do esquema.
   * @param {!Sheet} sheet
   * @param {string} sheetName
   */
  ensureHeaders: function (sheet, sheetName) {
    var headers = Config.getSchema(sheetName).headers;
    var lastColumn = sheet.getLastColumn();
    var current = lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
      : [];
    if (!current.length || !current.some(function (value) { return !Utils.isBlank(value); })) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      current = headers.slice();
    } else {
      var missing = headers.filter(function (header) { return current.indexOf(header) === -1; });
      if (missing.length) {
        sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
        current = current.concat(missing);
      }
    }

    // Ao encontrar cabecalhos legados (por exemplo, `Username`/`Senha`),
    // preenche as colunas canonicas sem apagar dados que ja estejam nelas.
    // A leitura e feita uma vez e cada coluna e gravada em lote para evitar
    // chamadas por celula no Apps Script.
    var rowCount = sheet.getLastRow() - 1;
    if (rowCount > 0) {
      var rows = sheet.getRange(2, 1, rowCount, current.length).getValues();
      headers.forEach(function (header) {
        var targetIndex = current.indexOf(header);
        if (targetIndex === -1) return;
        var sourceIndex = SheetManager.findHeaderIndex_(
            current, SheetManager.headerAliases_(sheetName, header), targetIndex);
        if (sourceIndex === -1) return;

        var changed = false;
        var values = rows.map(function (row) {
          var target = row[targetIndex];
          var source = row[sourceIndex];
          if (Utils.isBlank(target) && !Utils.isBlank(source)) {
            row[targetIndex] = source;
            changed = true;
          }
          return [row[targetIndex]];
        });
        if (changed) {
          sheet.getRange(2, targetIndex + 1, rowCount, 1).setValues(values);
        }
      });

      // Linhas de alunos cadastradas manualmente costumam trazer somente
      // Usuario/Senha. Sem `id`, a senha confere mas a sessão não pode ser
      // criada. Complete apenas os campos operacionais vazios, preservando os
      // valores existentes e mantendo um único batch por coluna.
      if (sheetName === Config.SHEETS.USERS) {
        var defaults = {
          id: function () { return Utils.uuid(); },
          role: function () { return Config.AUTH.DEFAULT_ROLE; },
          coins: function () { return 0; },
          createdAt: function () { return Utils.nowIso(); }
        };
        Object.keys(defaults).forEach(function (header) {
          var column = current.indexOf(header);
          var usernameColumn = current.indexOf('username');
          var passwordColumn = current.indexOf('password');
          if (column === -1 || usernameColumn === -1 || passwordColumn === -1) return;
          var changed = false;
          var values = rows.map(function (row) {
            var hasAccount = !Utils.isBlank(row[usernameColumn]) && !Utils.isBlank(row[passwordColumn]);
            if (hasAccount && Utils.isBlank(row[column])) {
              row[column] = defaults[header]();
              changed = true;
            }
            return [row[column]];
          });
          if (changed) sheet.getRange(2, column + 1, rowCount, 1).setValues(values);
        });
      }
    }
    sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn())).setFontWeight('bold');
    sheet.setFrozenRows(1);
  },

  /**
   * Cabecalho efetivo da aba (linha 1).
   * @param {!Sheet} sheet
   * @return {!Array<string>}
   */
  getHeaders: function (sheet) {
    var lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (header) {
      return Utils.str(header);
    });
  },

  /**
   * Todas as linhas de dados, sem o cabecalho.
   * @param {!Sheet} sheet
   * @return {!Array<!Array<*>>}
   */
  getDataRows: function (sheet) {
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn === 0) return [];
    return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  },

  /**
   * Cria todas as abas declaradas em Config.SHEETS.
   * @return {!Array<string>} Nomes das abas garantidas.
   */
  ensureAllSheets: function () {
    return Object.keys(Config.SHEETS).map(function (key) {
      var sheetName = Config.SHEETS[key];
      SheetManager.getSheet(sheetName);
      return sheetName;
    });
  },

  montarOuRemontarPlanilhas: function (options) {
    options = options || {};
    var remount = options.mode === 'remontar' || options.remount === true;
    if (remount && options.confirmation !== 'REMONTAR_PLANILHAS') throw new Error('Confirme com REMONTAR_PLANILHAS.');
    var spreadsheet = SheetManager.getSpreadsheet();
    var results = Object.keys(Config.SHEETS).map(function (key) {
      var name = Config.SHEETS[key];
      var sheet = spreadsheet.getSheetByName(name);
      var created = !sheet;
      if (!sheet) sheet = spreadsheet.insertSheet(name);
      if (remount) sheet.clear();
      SheetManager.ensureHeaders(sheet, name);
      var expected = Config.getSchema(name).headers;
      var current = SheetManager.getHeaders(sheet);
      var missing = expected.filter(function (header) { return current.indexOf(header) === -1; });
      if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      return { sheetName: name, created: created, remounted: remount, columns: expected.length };
    });
    return { ok: true, mode: remount ? 'remontar' : 'montar', sheets: results };
  },

  /**
   * Executa `fn` com o lock do script, serializando escritas concorrentes.
   * @param {function(): *} fn
   * @param {number=} timeoutMs
   * @return {*}
   */
  withLock: function (fn, timeoutMs) {
    // Operações de domínio podem compor vários CRUDs sob uma única transação.
    // Nesse caso, os CRUDs internos reutilizam o lock já adquirido pela mesma
    // execução, em vez de tentar obtê-lo novamente e causar deadlock.
    if (SheetManager.lockDepth_ > 0) {
      SheetManager.lockDepth_++;
      try {
        return fn();
      } finally {
        SheetManager.lockDepth_--;
      }
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(timeoutMs || 15000)) {
      throw new AppError(Errors.CODES.INTERNAL,
                         'Servidor ocupado. Tente novamente em instantes.');
    }
    SheetManager.lockDepth_ = 1;
    try {
      return fn();
    } finally {
      SheetManager.lockDepth_ = 0;
      lock.releaseLock();
    }
  },

  /** Profundidade do lock na execução atual; globais não são compartilhados entre execuções. */
  lockDepth_: 0
};

var SchemaService = SheetManager;

/** Inicializa diretamente as abas declaradas em Config.SHEETS. */
function setupSobreEncantosSchema(options) {
  return SchemaService.montarOuRemontarPlanilhas(options || {});
}

/**
 * Insere duas linhas sintéticas em cada aba declarada, preservando registros
 * existentes. As credenciais são intencionalmente em texto plano para testes
 * de integração: aluno01/senhafacil e aluno02/senhafacil2.
 */
function popularDadosSinteticosSobreEncantos(options) {
  options = options || {};
  setupSobreEncantosSchema(options.schema || {});
  return SheetManager.withLock(function () {
    var ss = SheetManager.getSpreadsheet();
    var now = Utils.nowIso();
    var users = [
      { id: 'synthetic-sobre-user-01', username: 'aluno01', password: 'senhafacil', email: 'aluno01@example.edu', role: 'player', coins: 30 },
      { id: 'synthetic-sobre-user-02', username: 'aluno02', password: 'senhafacil2', email: 'aluno02@example.edu', role: 'player', coins: 45 }
    ];
    var rows = {
      Users: users,
      Sessions: users.map(function (u, i) { return { id: 'synthetic-sobre-session-0' + (i + 1), userId: u.id, tokenHash: 'synthetic-token-' + (i + 1), username: u.username, role: u.role, expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: now, updatedAt: now }; }),
      Progress: users.map(function (u, i) { return { id: 'synthetic-sobre-progress-0' + (i + 1), userId: u.id, currentLevel: i + 1, maxLevelReached: i + 1, totalDistance: 120 + i * 80, state: JSON.stringify({ tutorial: true, level: i + 1 }), createdAt: now, updatedAt: now }; }),
      Scores: users.map(function (u, i) { return { id: 'synthetic-sobre-score-0' + (i + 1), userId: u.id, username: u.username, level: i + 1, score: 72 + i * 11, distance: 120 + i * 80, coins: u.coins, createdAt: now, updatedAt: now }; }),
      Settings: users.map(function (u, i) { return { id: 'synthetic-sobre-settings-0' + (i + 1), userId: u.id, settings: JSON.stringify({ sound: i === 0, contrast: 'high' }), createdAt: now, updatedAt: now }; }),
      Logs: [{ timestamp: now, level: 'INFO', message: 'Seed sintético 1', context: 'seed' }, { timestamp: now, level: 'INFO', message: 'Seed sintético 2', context: 'seed' }]
    };
    var seeded = {};
    Object.keys(Config.SHEETS).forEach(function (key) {
      var name = Config.SHEETS[key];
      var sheet = SheetManager.getSheet(name);
      var headers = Config.getSchema(name).headers;
      var first = headers[0];
      var firstIndex = headers.indexOf(first);
      var existing = SheetManager.getDataRows(sheet);
      var known = {};
      existing.forEach(function (row) { known[String(row[firstIndex] || '')] = true; });
      var pending = (rows[name] || [{ id: 'synthetic-sobre-' + name.toLowerCase() + '-01' }, { id: 'synthetic-sobre-' + name.toLowerCase() + '-02' }]).filter(function (item) {
        return !known[String(item[first] || '')];
      }).map(function (item) { return headers.map(function (header) { return item[header] === undefined ? '' : item[header]; }); });
      if (pending.length) sheet.getRange(sheet.getLastRow() + 1, 1, pending.length, headers.length).setValues(pending);
      seeded[name] = pending.length;
    });
    return { ok: true, synthetic: true, credentials: users.map(function (u) { return { username: u.username, password: u.password }; }), seeded: seeded };
  });
}
