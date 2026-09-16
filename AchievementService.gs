/**
 * AchievementService.gs
 * Regras deterministicas para desbloqueio e consulta de conquistas.
 *
 * A avaliacao recebe apenas progresso e estatisticas do servidor. Isso evita
 * confiar em flags enviadas pelo cliente e deixa a regra facil de testar.
 */
var AchievementService = {

  CATALOG: [
    { id: 'first-flight', name: 'Primeiro voo', description: 'Conclua uma partida.',
      rewardCoins: 10 },
    { id: 'long-distance', name: 'Pe no ceu', description: 'Percorra 1.000 metros.',
      rewardCoins: 20 },
    { id: 'three-levels', name: 'Explorador', description: 'Alcance o nivel 3.',
      rewardCoins: 30 },
    { id: 'high-score', name: 'Boa pontuacao', description: 'Faca 500 pontos em uma partida.',
      rewardCoins: 25 }
  ],

  /**
   * Catalogo publico, sem permitir que o chamador altere a fonte original.
   * @return {!Array<!Object>}
   */
  list: function () {
    return Utils.clone(AchievementService.CATALOG);
  },

  /**
   * Soma as recompensas das conquistas recem-desbloqueadas.
   * IDs desconhecidos e repetidos sao ignorados para que a operacao continue
   * segura mesmo se a lista vier de uma fonte externa ou for montada duas vezes.
   * @param {!Array<string>} ids
   * @return {number} Total inteiro de moedas a creditar.
   */
  rewardCoinsFor: function (ids) {
    if (!Array.isArray(ids)) return 0;
    var seen = [];
    return ids.reduce(function (total, id) {
      if (seen.indexOf(id) !== -1) return total;
      seen.push(id);
      var item = AchievementService.CATALOG.filter(function (achievement) {
        return achievement.id === id;
      })[0];
      if (!item) return total;
      var reward = Utils.toInt(item.rewardCoins);
      return reward > 0 ? total + reward : total;
    }, 0);
  },

  /**
   * Avalia conquistas a partir de dados ja validados pelo backend.
   * @param {!Object} progress
   * @param {!Object} stats
   * @return {!Array<string>} ids desbloqueados, sem duplicatas.
   */
  evaluate: function (progress, stats) {
    var p = progress || {};
    var s = stats || {};
    var state = p.state || {};
    var completed = Array.isArray(state.levelsCompleted) ? state.levelsCompleted : [];
    var unlocked = [];

    if (Utils.toInt(s.gamesPlayed) > 0) unlocked.push('first-flight');
    if (Utils.toNumber(p.totalDistance) >= 1000) unlocked.push('long-distance');
    if (Utils.toInt(p.maxLevelReached) >= 3) unlocked.push('three-levels');
    if (Utils.toInt(s.bestScore) >= 500) unlocked.push('high-score');
    if (completed.length > 0 && unlocked.indexOf('first-flight') === -1) {
      unlocked.push('first-flight');
    }
    return unlocked;
  },

  /**
   * Conquistas do jogador, combinando catalogo e estado atual.
   * @param {string} userId
   * @return {!Array<!Object>}
   */
  forPlayer: function (userId) {
    var progress = ProgressService.getProgress(userId);
    var stats = ScoreService.getStats(userId);
    var unlocked = AchievementService.evaluate(progress, stats);
    return AchievementService.CATALOG.map(function (item) {
      var result = Utils.clone(item);
      result.unlocked = unlocked.indexOf(item.id) !== -1;
      return result;
    });
  }
};
