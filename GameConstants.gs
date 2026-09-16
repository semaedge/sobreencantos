/**
 * GameConstants.gs
 * Constantes de jogo e a definicao dos niveis brasileiros.
 *
 * O backend e a fonte da verdade dessas constantes: o frontend as busca em
 * api_getGameData() para que balanceamento mude sem novo deploy do HTML.
 */
var GameConstants = {

  /** Grade e mundo. */
  TILE_SIZE: 32,
  VIEWPORT_TILES_X: 24,
  VIEWPORT_TILES_Y: 14,

  /** Fisica do jetpack (unidades por frame, a 60 fps). */
  PHYSICS: {
    GRAVITY: 0.55,
    THRUST: -1.05,
    MAX_FALL_SPEED: 12,
    MAX_RISE_SPEED: -10,
    SCROLL_SPEED: 4.5
  },

  /** Jogador. */
  PLAYER: {
    START_LIVES: 3,
    MAX_FUEL: 100,
    FUEL_BURN_PER_FRAME: 0.35,
    FUEL_REGEN_PER_FRAME: 0.12,
    HITBOX_WIDTH: 26,
    HITBOX_HEIGHT: 40
  },

  /** Pontuacao. */
  SCORING: {
    POINTS_PER_METER: 1,
    POINTS_PER_COIN: 10,
    POINTS_PER_ENEMY: 25,
    POINTS_PER_WORD_DODGE: 40,
    LEVEL_COMPLETE_BONUS: 500,
    COINS_PER_LEVEL_COMPLETE: 20
  },

  /** Multiplicadores por dificuldade. */
  DIFFICULTY: {
    easy:   { enemySpeed: 0.8, spawnRate: 0.7, scoreMultiplier: 0.8 },
    normal: { enemySpeed: 1.0, spawnRate: 1.0, scoreMultiplier: 1.0 },
    hard:   { enemySpeed: 1.3, spawnRate: 1.4, scoreMultiplier: 1.5 }
  },

  /** Power-ups disponiveis. */
  POWER_UPS: [
    { id: 'shield',      name: 'Escudo',            durationMs: 8000,  effect: 'invulnerable' },
    { id: 'turbo',       name: 'Turbo',             durationMs: 5000,  effect: 'speedBoost' },
    { id: 'magnet',      name: 'Ima de Moedas',     durationMs: 10000, effect: 'coinMagnet' },
    { id: 'infiniteFuel', name: 'Combustivel Infinito', durationMs: 6000, effect: 'noFuelBurn' }
  ],

  /** Tipos de inimigo. */
  ENEMIES: [
    { id: 'drone',    name: 'Drone',             speed: 3.0, damage: 1, points: 25 },
    { id: 'bird',     name: 'Ave',               speed: 2.2, damage: 1, points: 15 },
    { id: 'balloon',  name: 'Balao',             speed: 1.4, damage: 1, points: 10 },
    { id: 'lightning', name: 'Raio',             speed: 5.0, damage: 2, points: 40 }
  ],

  /**
   * Os 10 niveis, um por capital, cada um com sua atracao natural.
   * `unlockScore` e a pontuacao total acumulada para liberar o nivel.
   *
   * `words` e o conteudo didatico do nivel: cada par vira um obstaculo-palavra
   * pendurado no teto que, ao se aproximar do jogador, cospe uma unica vez a
   * palavra associada (`spits`). `hint` e a frase que explica o vinculo entre as
   * duas e aparece na tela junto com o par. Todo nivel tem ao menos um par.
   */
  LEVELS: [
    { id: 1,  city: 'Sao Paulo',      state: 'SP', attraction: 'Serra da Cantareira',
      palette: 'mataAtlantica', lengthMeters: 1200, unlockScore: 0,     difficulty: 'easy',
      words: [
        { word: 'DESMATAMENTO', spits: 'ENCHENTE',
          hint: 'Com menos plantas, o solo segura menos água. Em chuva forte, isso pode aumentar o risco de enchente.' },
        { word: 'POLUIÇÃO', spits: 'ASMA',
          hint: 'A fumaça e a fuligem podem irritar os pulmões e piorar problemas respiratórios.' }
      ] },
    { id: 2,  city: 'Rio de Janeiro', state: 'RJ', attraction: 'Pao de Acucar',
      palette: 'baiaGuanabara',  lengthMeters: 1400, unlockScore: 800,   difficulty: 'easy',
      words: [
        { word: 'ESGOTO', spits: 'CONTAMINAÇÃO',
          hint: 'Esgoto sem tratamento na baía contamina a água, o peixe e a praia.' },
        { word: 'PESCA PREDATÓRIA', spits: 'ESCASSEZ',
          hint: 'Quando muitos peixes são retirados antes de se reproduzir, pode haver menos peixes no futuro.' }
      ] },
    { id: 3,  city: 'Brasilia',       state: 'DF', attraction: 'Parque Nacional de Brasilia',
      palette: 'cerrado',        lengthMeters: 1600, unlockScore: 2000,  difficulty: 'normal',
      words: [
        { word: 'FALTA DE TRANSPARÊNCIA', spits: 'DESCONFIANÇA',
          hint: 'Quando decisões públicas não são explicadas, fica mais difícil acompanhar e confiar.' },
        { word: 'FALTA DE FISCALIZAÇÃO', spits: 'RISCO',
          hint: 'Regras e fiscalização ajudam a prevenir problemas e a cuidar do que é de todos.' }
      ] },
    { id: 4,  city: 'Fortaleza',      state: 'CE', attraction: 'Parque do Coco',
      palette: 'litoralNordeste', lengthMeters: 1800, unlockScore: 3600, difficulty: 'normal',
      words: [
        { word: 'QUEIMADA', spits: 'FUMAÇA',
          hint: 'A fumaça das queimadas piora a qualidade do ar e pode causar problemas para respirar.' },
        { word: 'LIXO NA RUA', spits: 'ENTUPIMENTO',
          hint: 'O lixo desce pelo bueiro, tranca a água e a rua vira rio.' }
      ] },
    { id: 5,  city: 'Salvador',       state: 'BA', attraction: 'Lagoa do Abaete',
      palette: 'dunasBahia',     lengthMeters: 2000, unlockScore: 5600,  difficulty: 'normal',
      words: [
        { word: 'EXTRAÇÃO DE AREIA', spits: 'EROSÃO',
          hint: 'Duna sem areia não segura o vento nem protege a lagoa.' },
        { word: 'DESCARTE IRREGULAR', spits: 'DOENÇA',
          hint: 'Recipientes com água parada podem virar criadouros do mosquito que transmite dengue.' }
      ] },
    { id: 6,  city: 'Belo Horizonte', state: 'MG', attraction: 'Serra do Curral',
      palette: 'serraMineira',   lengthMeters: 2200, unlockScore: 8000,  difficulty: 'normal',
      words: [
        { word: 'MINERAÇÃO', spits: 'REJEITO',
          hint: 'Rejeito é o que sobra do minério e fica represado atrás da barragem.' },
        { word: 'BARRAGEM', spits: 'ROMPIMENTO',
          hint: 'Barragens precisam de projeto, manutenção e fiscalização para reduzir o risco de rompimento.' }
      ] },
    { id: 7,  city: 'Manaus',         state: 'AM', attraction: 'Encontro das Aguas',
      palette: 'amazonia',       lengthMeters: 2400, unlockScore: 10800, difficulty: 'hard',
      words: [
        { word: 'GARIMPO', spits: 'MERCÚRIO',
          hint: 'Em alguns garimpos, o mercúrio pode contaminar rios, peixes e pessoas.' },
        { word: 'GRILAGEM', spits: 'DESMATAMENTO',
          hint: 'A ocupação ilegal de terras públicas costuma estar ligada ao corte da floresta.' }
      ] },
    { id: 8,  city: 'Curitiba',       state: 'PR', attraction: 'Parque Barigui',
      palette: 'araucaria',      lengthMeters: 2600, unlockScore: 14000, difficulty: 'hard',
      words: [
        { word: 'AGROTÓXICO', spits: 'CONTAMINAÇÃO',
          hint: 'O uso incorreto de agrotóxicos pode levar substâncias da lavoura para o solo e a água.' },
        { word: 'IMPERMEABILIZAÇÃO', spits: 'ALAGAMENTO',
          hint: 'Chão coberto de asfalto não bebe a chuva: ela toda vira enxurrada.' }
      ] },
    { id: 9,  city: 'Recife',         state: 'PE', attraction: 'Recifes de Boa Viagem',
      palette: 'recifeCoral',    lengthMeters: 2800, unlockScore: 17600, difficulty: 'hard',
      words: [
        { word: 'PLÁSTICO', spits: 'MICROPLÁSTICO',
          hint: 'O plástico não some: quebra em pedaços minúsculos que o peixe engole.' },
        { word: 'AQUECIMENTO', spits: 'BRANQUEAMENTO',
          hint: 'Água muito quente pode fazer o coral perder as algas que vivem com ele e ficar branco.' }
      ] },
    { id: 10, city: 'Goiania',        state: 'GO', attraction: 'Parque Flamboyant',
      palette: 'cerradoGoiano',  lengthMeters: 3000, unlockScore: 21600, difficulty: 'hard',
      words: [
        { word: 'SECA', spits: 'DESERTIFICAÇÃO',
          hint: 'Secas repetidas e solo sem proteção podem deixar a terra cada vez menos fértil.' },
        { word: 'DESPERDÍCIO', spits: 'ESCASSEZ',
          hint: 'Evitar desperdício ajuda a preservar água para mais pessoas e para o futuro.' }
      ] }
  ],

  /** Configuracoes padrao de um novo usuario. */
  DEFAULT_SETTINGS: {
    musicVolume: 0.6,
    sfxVolume: 0.8,
    difficulty: 'normal',
    controls: 'touch',
    language: 'pt-BR',
    showTutorial: true
  },

  /**
   * Definicao de um nivel.
   * @param {number|string} levelId
  * @return {?Object}
  */
  getLevel: function (levelId) {
    if (levelId === null || levelId === undefined ||
        (typeof levelId !== 'number' && typeof levelId !== 'string') ||
        (typeof levelId === 'string' && levelId.trim() === '')) {
      return null;
    }
    var id = Number(levelId);
    if (!isFinite(id) || Math.floor(id) !== id) return null;
    var found = GameConstants.LEVELS.filter(function (level) { return level.id === id; });
    return found.length > 0 ? found[0] : null;
  },

  /** @return {number} Maior id de nivel existente. */
  getMaxLevelId: function () {
    return GameConstants.LEVELS[GameConstants.LEVELS.length - 1].id;
  },

  /**
   * Multiplicadores da dificuldade, com fallback para 'normal'.
   * @param {string} difficulty
   * @return {!Object}
   */
  getDifficulty: function (difficulty) {
    return GameConstants.DIFFICULTY[difficulty] || GameConstants.DIFFICULTY.normal;
  }
};
