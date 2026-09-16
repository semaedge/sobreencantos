/** Imagens contratuais do Drive; alternativas visuais pertencem ao HTML/CSS. */
var GAME_ASSET_PROJECT = 'sobre_encantos';
var GAME_ASSET_FILES = ['sobre_encantos_map.svg', 'explorador_avatar.png'];
var GAME_ASSET_OPTIONAL_FILES = [];

function getGameAssetManifest() {
  return GameAssetService.getManifest(GAME_ASSET_FILES, GAME_ASSET_OPTIONAL_FILES, GAME_ASSET_PROJECT);
}

// Fachada preservada. Sem cache persistente: mudar FOLDER_ID deve valer na próxima chamada.
var GameAssetService = {
  getManifest: function(required, optional, project) {
    return GameAssetService_getManifest_(required, optional, project);
  },
  invalidateCache: function(project) {
    CacheService.getScriptCache().remove('assetManifest_v2_' + (project || GAME_ASSET_PROJECT));
  },
  setup: function() {
    var manifest = getGameAssetManifest();
    return { success: manifest.ok, manifest: manifest,
      message: manifest.ok ? 'Imagens configuradas via ' + manifest.configuredBy + '.' : manifest.error,
      instructions: manifest.ok ? [] : ['Configure FOLDER_ID nas Propriedades do script.',
        'Confira os nomes exatos e os tipos PNG/SVG na raiz da pasta.',
        'Verifique acesso de leitura para a conta executora e para a audiência do Web App.'] };
  }
};

/** Espelho de webapp/assets no Drive: somente a Script Property FOLDER_ID. */
function GameAssetService_resolveFolder_() {
  var value = String(PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  return { id: value, configuredBy: value ? 'FOLDER_ID' : '' };
}

function GameAssetService_getManifest_(requiredFiles, optionalFiles, project) {
  requiredFiles = requiredFiles || [];
  optionalFiles = optionalFiles || [];
  var expectedFiles = requiredFiles.concat(optionalFiles);
  var base = {
    project: project || '', folderProperty: 'FOLDER_ID', configuredBy: '',
    requiredFiles: requiredFiles, optionalFiles: optionalFiles, expectedFiles: expectedFiles,
    assets: {}, assetItems: [], missingRequiredFiles: requiredFiles.slice(),
    missingOptionalFiles: optionalFiles.slice(), ignoredFileCount: 0,
    invalidFiles: [], duplicateFiles: [], ok: false
  };
  try {
    var folder = GameAssetService_resolveFolder_();
    base.configuredBy = folder.configuredBy;
    if (!folder.id) {
      base.error = 'Configure a Script Property FOLDER_ID com a pasta de imagens deste jogo.';
      return base;
    }
    var seen = {};
    var files = DriveApp.getFolderById(folder.id).getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (expectedFiles.indexOf(name) < 0) { base.ignoredFileCount += 1; continue; }
      if (seen[name]) {
        if (base.duplicateFiles.indexOf(name) < 0) base.duplicateFiles.push(name);
        delete base.assets[name];
        continue;
      }
      seen[name] = true;
      var mime = file.getMimeType();
      // Não basta trocar a extensão: PNG/SVG devem ter o formato correspondente.
      if ((/\.png$/.test(name) && mime !== 'image/png') ||
          (/\.svg$/.test(name) && mime !== 'image/svg+xml')) {
        base.invalidFiles.push({ name: name, mimeType: mime });
        continue;
      }
      var url = 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId());
      base.assets[name] = url;
      base.assetItems.push({ name: name, url: url, mimeType: mime, required: requiredFiles.indexOf(name) >= 0 });
    }
    base.assetItems = base.assetItems.filter(function(item) { return Boolean(base.assets[item.name]); });
    base.missingRequiredFiles = requiredFiles.filter(function(name) { return !base.assets[name]; });
    base.missingOptionalFiles = optionalFiles.filter(function(name) { return !base.assets[name]; });
    base.ok = base.missingRequiredFiles.length === 0;
    if (!base.ok) base.error = 'Arquivos obrigatórios ausentes ou inválidos em FOLDER_ID: ' + base.missingRequiredFiles.join(', ');
    return base;
  } catch (error) {
    Logger.log('[GameAssetService] ' + error.message);
    // Uma leitura interrompida não deve apresentar um catálogo parcial como completo.
    base.assets = {};
    base.assetItems = [];
    base.error = 'Não foi possível ler a pasta configurada em FOLDER_ID.';
    return base;
  }
}
