/**
 * InventoryService.gs
 * Inventario persistido no estado de progresso do jogador.
 *
 * O estado permanece dentro da aba Progress, mantendo o schema aditivo e
 * permitindo que partidas antigas continuem legiveis sem migracao destrutiva.
 */
var InventoryService = {

  ITEMS: [
    { id: 'shield', name: 'Escudo', description: 'Evita dano por 8 segundos.', maxQuantity: 99 },
    { id: 'turbo', name: 'Turbo', description: 'Aumenta a velocidade por 5 segundos.', maxQuantity: 99 },
    { id: 'magnet', name: 'Ima de moedas', description: 'Atrai moedas por 10 segundos.', maxQuantity: 99 },
    { id: 'infiniteFuel', name: 'Combustivel infinito', description: 'Suspende o consumo de combustivel.', maxQuantity: 99 }
  ],

  /** @return {!Array<!Object>} */
  listItems: function () {
    return InventoryService.ITEMS.map(function (item) {
      var result = Utils.clone(item);
      result.price = ShopService.quote(item.id, 1).unitPrice;
      return result;
    });
  },

  /**
   * Normaliza um mapa de quantidades, descartando itens desconhecidos e
   * impedindo valores negativos ou fracionarios.
   * @param {*} raw
   * @return {!Object}
   */
  normalize: function (raw) {
    var source = raw && Object.prototype.toString.call(raw) === '[object Object]' ? raw : {};
    var out = {};
    InventoryService.ITEMS.forEach(function (item) {
      var quantity = Utils.toInt(source[item.id], 0);
      out[item.id] = Utils.clamp(quantity, 0, item.maxQuantity);
    });
    return out;
  },

  /**
   * Retorna os itens do jogador com quantidade explicita.
   * @param {string} userId
   * @return {!Array<!Object>}
   */
  get: function (userId) {
    var progress = ProgressService.getProgress(userId);
    var quantities = InventoryService.normalize((progress.state || {}).inventory);
    return InventoryService.listItems().map(function (item) {
      var result = Utils.clone(item);
      result.quantity = quantities[item.id];
      return result;
    });
  },

  /**
   * Credita itens sem aceitar ids ou quantidades arbitrarias.
   * @param {string} userId
   * @param {string} itemId
   * @param {number} quantity
   * @return {!Array<!Object>}
   */
  grant: function (userId, itemId, quantity) {
    var item = InventoryService.item_(itemId);
    var amount = InventoryService.quantity_(quantity);
    return SheetManager.withLock(function () {
      var progress = ProgressService.getProgress(userId);
      var state = Utils.clone(progress.state) || {};
      var inventory = InventoryService.normalize(state.inventory);
      var next = inventory[item.id] + amount;
      if (next > item.maxQuantity) throw Errors.validation('Limite do item atingido.');
      inventory[item.id] = next;
      state.inventory = inventory;
      ProgressService.updateRow_(userId, { state: state });
      return InventoryService.get(userId);
    });
  },

  /**
   * Consome itens sob o mesmo bloqueio usado pela loja, da leitura ao retorno.
   * @param {string} userId
   * @param {string} itemId
   * @param {number} quantity
   * @return {!Array<!Object>}
   */
  consume: function (userId, itemId, quantity) {
    var item = InventoryService.item_(itemId);
    var amount = InventoryService.quantity_(quantity);
    return SheetManager.withLock(function () {
      var progress = ProgressService.getProgress(userId);
      var state = Utils.clone(progress.state) || {};
      var inventory = InventoryService.normalize(state.inventory);
      if (inventory[item.id] < amount) throw Errors.validation('Item insuficiente.');
      inventory[item.id] -= amount;
      state.inventory = inventory;
      ProgressService.updateRow_(userId, { state: state });
      AppLogger.info('Item consumido.', { userId: userId, itemId: itemId, quantity: amount });
      return InventoryService.get(userId);
    });
  },

  /**
   * Compra itens usando moedas do jogador.
   * @param {string} userId
   * @param {string} itemId
   * @param {number} quantity
   * @return {!Array<!Object>}
   */
  buy: function (userId, itemId, quantity) {
    // Mantem o retorno legado, usando o catalogo, o saldo e o bloqueio da loja.
    return ShopService.purchase(userId, itemId, quantity).inventory;
  },

  /** @param {string} itemId @return {!Object} @private */
  item_: function (itemId) {
    var id = Utils.str(itemId);
    var item = InventoryService.ITEMS.filter(function (candidate) {
      return candidate.id === id;
    })[0];
    if (!item) throw Errors.validation('Item desconhecido.');
    return item;
  },

  /** @param {*} value @return {number} @private */
  quantity_: function (value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw Errors.validation('Quantidade invalida.');
    }
    var quantity = Number(value);
    if (!isFinite(quantity) || Math.floor(quantity) !== quantity || quantity < 1) {
      throw Errors.validation('Quantidade invalida.');
    }
    return quantity;
  }
};
