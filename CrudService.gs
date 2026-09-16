/**
 * CrudService.gs
 * CRUD generico sobre Google Sheets, guiado pelos esquemas de Config.
 *
 * Cada registro tem `id` (UUID), `createdAt` e `updatedAt` em ISO 8601.
 * Colunas listadas em `jsonFields` sao serializadas/desserializadas.
 */
var CrudService = {

  /**
   * Insere um registro. Gera id e timestamps.
   * @param {string} sheetName
   * @param {!Object} record
   * @return {!Object} O registro gravado.
   */
  create: function (sheetName, record) {
    return SheetManager.withLock(function () {
      var sheet = SheetManager.getSheet(sheetName);
      var now = Utils.nowIso();
      var full = Utils.clone(record) || {};

      full.id = full.id || Utils.uuid();
      full.createdAt = full.createdAt || now;
      full.updatedAt = now;

      sheet.appendRow(CrudService.toRow_(sheetName, sheet, full));
      return full;
    });
  },

  /**
   * Todos os registros da aba.
   * @param {string} sheetName
   * @return {!Array<!Object>}
   */
  findAll: function (sheetName) {
    var sheet = SheetManager.getSheet(sheetName);
    var headers = SheetManager.getHeaders(sheet);
    return SheetManager.getDataRows(sheet).map(function (row) {
      return CrudService.toObject_(sheetName, headers, row);
    });
  },

  /**
   * Registro por id.
   * @param {string} sheetName
   * @param {string} id
   * @return {?Object} null se nao existir.
   */
  findById: function (sheetName, id) {
    var found = CrudService.findBy(sheetName, { id: id });
    return found.length > 0 ? found[0] : null;
  },

  /**
   * Registros que casam com todos os pares de `criteria` (comparacao por
   * string, insensivel a caixa).
   * @param {string} sheetName
   * @param {!Object} criteria
   * @return {!Array<!Object>}
   */
  findBy: function (sheetName, criteria) {
    var keys = Object.keys(criteria);
    return CrudService.findAll(sheetName).filter(function (record) {
      return keys.every(function (key) {
        return Utils.str(record[key]).toLowerCase() ===
               Utils.str(criteria[key]).toLowerCase();
      });
    });
  },

  /**
   * Primeiro registro que casa com `criteria`.
   * @param {string} sheetName
   * @param {!Object} criteria
   * @return {?Object}
   */
  findOne: function (sheetName, criteria) {
    var found = CrudService.findBy(sheetName, criteria);
    return found.length > 0 ? found[0] : null;
  },

  /**
   * Aplica um patch parcial ao registro. `id` e `createdAt` sao preservados.
   * @param {string} sheetName
   * @param {string} id
   * @param {!Object} patch
   * @return {!Object} O registro atualizado.
   */
  update: function (sheetName, id, patch) {
    return SheetManager.withLock(function () {
      var sheet = SheetManager.getSheet(sheetName);
      var headers = SheetManager.getHeaders(sheet);
      var rowIndex = CrudService.findRowIndex_(sheet, headers, id);
      if (rowIndex === -1) {
        throw Errors.notFound('Registro nao encontrado em ' + sheetName + ': ' + id);
      }

      var current = CrudService.toObject_(
          sheetName, headers,
          sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0]);

      var merged = Utils.clone(current);
      Object.keys(patch).forEach(function (key) {
        if (key !== 'id' && key !== 'createdAt' && patch[key] !== undefined) {
          merged[key] = patch[key];
        }
      });
      merged.updatedAt = Utils.nowIso();

      sheet.getRange(rowIndex, 1, 1, headers.length)
           .setValues([CrudService.toRow_(sheetName, sheet, merged)]);
      return merged;
    });
  },

  /**
   * Atualiza o registro que casa com `criteria` ou cria um novo.
   * @param {string} sheetName
   * @param {!Object} criteria
   * @param {!Object} values
   * @return {!Object}
   */
  upsert: function (sheetName, criteria, values) {
    // A busca e a escrita precisam compartilhar o mesmo lock; bloquear apenas
    // create/update deixa uma janela para duas requisições criarem duplicatas.
    return SheetManager.withLock(function () {
      var existing = CrudService.findOne(sheetName, criteria);
      if (existing) return CrudService.update(sheetName, existing.id, values);

      var merged = Utils.clone(criteria);
      Object.keys(values).forEach(function (key) { merged[key] = values[key]; });
      return CrudService.create(sheetName, merged);
    });
  },

  /**
   * Remove o registro pelo id.
   * @param {string} sheetName
   * @param {string} id
   * @return {boolean} true se algo foi removido.
   */
  remove: function (sheetName, id) {
    return SheetManager.withLock(function () {
      var sheet = SheetManager.getSheet(sheetName);
      var headers = SheetManager.getHeaders(sheet);
      var rowIndex = CrudService.findRowIndex_(sheet, headers, id);
      if (rowIndex === -1) return false;
      sheet.deleteRow(rowIndex);
      return true;
    });
  },

  /**
   * @param {string} sheetName
   * @return {number} Quantidade de registros.
   */
  count: function (sheetName) {
    return SheetManager.getDataRows(SheetManager.getSheet(sheetName)).length;
  },

  /**
   * Numero da linha (base 1, ja considerando o cabecalho) de um id.
   * @param {!Sheet} sheet
   * @param {!Array<string>} headers
   * @param {string} id
   * @return {number} -1 se nao encontrado.
   * @private
   */
  findRowIndex_: function (sheet, headers, id) {
    var idColumn = headers.indexOf('id');
    if (idColumn === -1) throw new Error('Aba sem coluna id: ' + sheet.getName());

    var rows = SheetManager.getDataRows(sheet);
    var target = Utils.str(id);
    for (var i = 0; i < rows.length; i++) {
      if (Utils.str(rows[i][idColumn]) === target) return i + 2;
    }
    return -1;
  },

  /**
   * Converte uma linha da planilha em objeto.
   * @param {string} sheetName
   * @param {!Array<string>} headers
   * @param {!Array<*>} row
   * @return {!Object}
   * @private
   */
  toObject_: function (sheetName, headers, row) {
    var jsonFields = Config.getSchema(sheetName).jsonFields;
    var record = {};
    headers.forEach(function (header, index) {
      if (!header) return;
      var value = row[index];
      if (jsonFields.indexOf(header) !== -1) {
        record[header] = CrudService.parseJson_(value);
      } else if (value instanceof Date) {
        record[header] = value.toISOString();
      } else {
        record[header] = value;
      }
    });
    return record;
  },

  /**
   * Converte um objeto na linha correspondente ao cabecalho da aba.
   * @param {string} sheetName
   * @param {!Sheet} sheet
   * @param {!Object} record
   * @return {!Array<*>}
   * @private
   */
  toRow_: function (sheetName, sheet, record) {
    var headers = SheetManager.getHeaders(sheet);
    var jsonFields = Config.getSchema(sheetName).jsonFields;
    return headers.map(function (header) {
      var value = record[header];
      if (value === undefined || value === null) return '';
      if (jsonFields.indexOf(header) !== -1 && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    });
  },

  /**
   * Le um campo JSON tolerando celula vazia ou conteudo invalido.
   * @param {*} value
   * @return {?Object}
   * @private
   */
  parseJson_: function (value) {
    if (Utils.isBlank(value)) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch (err) {
      AppLogger.warn('Campo JSON invalido ignorado.', { value: String(value) });
      return null;
    }
  }
};
