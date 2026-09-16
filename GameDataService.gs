/**
 * GameDataService.gs
 * Fonte unica dos dados de jogo entregues ao cliente.
 *
 * A lista de niveis e as constantes eram montadas em tres lugares diferentes -
 * api_getGameData, ProgressService.getLevelSelection e GameSession.startGame -
 * e cada um mandava um recorte proprio. O cliente recebia fisica e pontuacao
 * duas vezes, por caminhos distintos, e podia acabar lendo metade de uma copia
 * e metade da outra.
 *
 * Agora as constantes saem daqui uma vez, na abertura, e o inicio de partida
 * manda somente o que e daquela partida.
 */
var GameDataService = {

  /**
   * Constantes de jogo. Publicas: nao dependem de quem esta jogando.
   * @return {!Object}
   */
  constantesDoJogo: function () {
    return {
      tileSize: GameConstants.TILE_SIZE,
      viewport: {
        tilesX: GameConstants.VIEWPORT_TILES_X,
        tilesY: GameConstants.VIEWPORT_TILES_Y
      },
      physics: GameConstants.PHYSICS,
      player: GameConstants.PLAYER,
      scoring: GameConstants.SCORING,
      powerUps: GameConstants.POWER_UPS,
      enemies: GameConstants.ENEMIES,
      levels: GameConstants.LEVELS,
      dificuldades: Object.keys(GameConstants.DIFFICULTY),
      defaultSettings: Utils.clone(GameConstants.DEFAULT_SETTINGS)
    };
  },

  /**
   * Niveis como um visitante nao autenticado ve: nada liberado, nada concluido.
   * Serve a tela de login e a vitrine antes de entrar.
   * @return {!Array<!Object>}
   */
  niveisPublicos: function () {
    return GameConstants.LEVELS.map(function (level) {
      var view = Utils.clone(level);
      view.unlocked = false;
      view.completed = false;
      return view;
    });
  },

  /**
   * Niveis com o desbloqueio e a conclusao do jogador aplicados.
   * @param {string} userId
   * @return {!Array<!Object>}
   */
  niveisDoJogador: function (userId) {
    var progresso = ProgressService.getProgress(userId);
    var concluidos = progresso.state.levelsCompleted || [];

    return GameConstants.LEVELS.map(function (level) {
      var view = Utils.clone(level);
      view.unlocked = level.id <= progresso.maxLevelReached;
      view.completed = concluidos.indexOf(level.id) !== -1;
      return view;
    });
  }
};
