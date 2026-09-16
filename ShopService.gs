/**
 * ShopService.gs
 * Loja segura: precos e itens vivem no backend; o cliente so informa o item.
 */
var ShopService = {

  CATALOG: [
    { id: 'shield', name: 'Escudo', price: 30, quantity: 1,
      description: 'Protege contra dano durante um voo.' },
    { id: 'turbo', name: 'Turbo', price: 24, quantity: 1,
      description: 'Acelera o jetpack por alguns segundos.' },
    { id: 'magnet', name: 'Ima de moedas', price: 20, quantity: 1,
      description: 'Atrai moedas proximas.' },
    { id: 'infiniteFuel', name: 'Combustivel infinito', price: 40, quantity: 1,
      description: 'Mantem o combustivel cheio durante o efeito.' }
  ],

  /** @return {!Array<!Object>} Catalogo sem referencia mutavel. */
  list: function () {
    return Utils.clone(ShopService.CATALOG);
  },

  /**
   * Calcula o total a partir de precos do servidor.
   * @param {string} itemId
   * @param {number} quantity
   * @return {!Object} {itemId, quantity, unitPrice, total}
   */
  quote: function (itemId, quantity) {
    var item = ShopService.item_(itemId);
    var amount = ShopService.quantity_(quantity);
    return { itemId: item.id, quantity: amount, unitPrice: item.price,
      total: item.price * amount };
  },

  /**
   * Verifica saldo sem produzir efeitos colaterais.
   * @param {string} userId
   * @param {string} itemId
   * @param {number} quantity
   * @return {!Object}
   */
  canPurchase: function (userId, itemId, quantity) {
    var quote = ShopService.quote(itemId, quantity);
    var balance = Utils.toInt(UserService.getById(userId).coins);
    return { allowed: balance >= quote.total, balance: balance, quote: quote };
  },

  /**
   * Debita moedas e credita o inventario. Todas as regras de preco ficam no
   * backend; um cliente nunca consegue alterar custo ou quantidade recebida.
   * @param {string} userId
   * @param {string} itemId
   * @param {number} quantity
   * @return {!Object}
   */
  purchase: function (userId, itemId, quantity) {
    var quote = ShopService.quote(itemId, quantity);
    return SheetManager.withLock(function () {
      var check = ShopService.canPurchase(userId, itemId, quantity);
      if (!check.allowed) throw Errors.validation('Saldo de moedas insuficiente.');

      // Valida a capacidade antes do debito. O mesmo lock cobre a leitura e
      // as escritas, impedindo que outra compra use a capacidade ja reservada.
      var item = InventoryService.item_(quote.itemId);
      var progress = ProgressService.getProgress(userId);
      var quantities = InventoryService.normalize((progress.state || {}).inventory);
      if (quantities[item.id] + quote.quantity > item.maxQuantity) {
        throw Errors.validation('Limite do item atingido.');
      }

      var balance = UserService.addCoins(userId, -quote.total);
      var inventory = InventoryService.grant(userId, quote.itemId, quote.quantity);
      AppLogger.info('Compra concluida.', { userId: userId, itemId: quote.itemId,
        quantity: quote.quantity, total: quote.total });
      return { quote: quote, balance: balance, inventory: inventory };
    });
  },

  /** @param {string} itemId @return {!Object} @private */
  item_: function (itemId) {
    var id = Utils.str(itemId);
    var item = ShopService.CATALOG.filter(function (candidate) {
      return candidate.id === id;
    })[0];
    if (!item) throw Errors.validation('Produto desconhecido.');
    return item;
  },

  /** @param {*} value @return {number} @private */
  quantity_: function (value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw Errors.validation('Quantidade invalida.');
    }
    var quantity = Number(value);
    if (!isFinite(quantity) || Math.floor(quantity) !== quantity || quantity < 1 || quantity > 99) {
      throw Errors.validation('Quantidade invalida.');
    }
    return quantity;
  }
};
