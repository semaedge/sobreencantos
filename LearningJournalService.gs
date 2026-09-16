/**
 * LearningJournalService.gs
 * Evidência pedagógica individual ligada a uma partida. Não armazena nome,
 * senha, token nem sequência de comandos; guarda apenas o raciocínio necessário
 * para comparar previsão, observação e revisão.
 * 
 * Suporta salvamentos parciais e rascunhos para reduzir barreira de entrada.
 */
var LearningJournalService = {

  DRAFT_CACHE_TTL_SECONDS: 21600, // fallback máximo do CacheService (6 horas)
  DRAFT_PROPERTY_PREFIX: 'learningDraft:v1:',

  /**
   * Gera uma chave estável que não expõe o identificador do estudante nas
   * propriedades do script.
   */
  draftPropertyKey_: function (userId, levelId) {
    var material = String(userId == null ? '' : userId) + '\u0000' +
      String(levelId == null ? '' : levelId);
    var hash = 0;
    for (var i = 0; i < material.length; i++) {
      hash = (hash * 31 + material.charCodeAt(i)) | 0;
    }
    return LearningJournalService.DRAFT_PROPERTY_PREFIX +
      Math.abs(hash).toString(36);
  },

  /**
   * Valida evidência pedagógica com severidade configurável.
   * @param {!Object} level
   * @param {!Object} learning
   * @param {boolean=} strict Modo estrito requer todos os campos completos
   * @return {!Object} { valid, normalized, warnings, suggestions }
   */
  validate: function (level, learning, strict) {
    if (!level || Object.prototype.toString.call(level) !== '[object Object]') {
      throw Errors.validation('Nivel inexistente.');
    }
    var entry;
    if (learning === undefined || learning === null) {
      entry = {};
    } else if (Object.prototype.toString.call(learning) !== '[object Object]') {
      throw Errors.validation('Evidencia pedagogica invalida.');
    } else {
      entry = learning;
    }
    var prediction = LearningJournalService.text_(entry.prediction, 600);
    var causalPair = LearningJournalService.text_(entry.causalPair, 180);
    var mechanism = LearningJournalService.text_(entry.mechanism, 800);
    var evidence = LearningJournalService.text_(entry.evidence, 600);
    var revision = LearningJournalService.text_(entry.revision, 600);
    
    var warnings = [];
    var suggestions = [];
    var isStrict = strict === true;

    // Validação de prediction
    if (prediction.length < 12) {
      if (isStrict) {
        throw Errors.validation('Registre uma hipótese antes de iniciar o nível.');
      }
      warnings.push('Hipótese muito curta. Descreva o que você espera observar.');
    }

    // Validação de causalPair com sugestões
    var allowedPairs = (level.words || []).map(function (pair) {
      return pair.word + ' → ' + pair.spits;
    });
    
    if (causalPair && allowedPairs.indexOf(causalPair) === -1) {
      // Busca par similar em vez de rejeitar imediatamente
      var similar = LearningJournalService.findSimilarPair_(causalPair, allowedPairs);
      if (similar) {
        suggestions.push('Você quis dizer "' + similar + '"?');
        if (isStrict) {
          throw Errors.validation('Escolha uma relação apresentada neste nível. Sugestão: ' + similar);
        }
      } else if (isStrict) {
        throw Errors.validation('Escolha uma relação socioambiental apresentada neste nível.');
      } else {
        warnings.push('Par causal não reconhecido. Opções: ' + allowedPairs.join(', '));
      }
    }

    // Validação de mechanism
    if (mechanism.length < 16) {
      if (isStrict) {
        throw Errors.validation('Explique como a ação pode produzir essa consequência.');
      }
      warnings.push('Mecanismo causal incompleto. Explique como uma coisa leva à outra.');
    }

    // Validação de evidence
    if (evidence.length < 12) {
      if (isStrict) {
        throw Errors.validation('Registre uma evidência observada durante o percurso.');
      }
      warnings.push('Evidência ausente. O que você observou durante o jogo?');
    }

    // Validação de revision
    if (revision.length < 12) {
      if (isStrict) {
        throw Errors.validation('Explique o que você manteria ou mudaria na hipótese.');
      }
      warnings.push('Reflexão incompleta. O que você manteria ou mudaria?');
    }

    var completeness = LearningJournalService.calculateCompleteness_({
      prediction: prediction,
      causalPair: causalPair,
      mechanism: mechanism,
      evidence: evidence,
      revision: revision
    });

    return {
      valid: isStrict ? warnings.length === 0 : true,
      normalized: {
        prediction: prediction,
        causalPair: causalPair,
        mechanism: mechanism,
        evidence: evidence,
        revision: revision
      },
      warnings: warnings,
      suggestions: suggestions,
      completeness: completeness,
      readyToSubmit: completeness >= 80
    };
  },

  /**
   * Calcula percentual de completude da evidência pedagógica.
   * @private
   */
  calculateCompleteness_: function (normalized) {
    var fields = [
      { key: 'prediction', minLength: 12, weight: 20 },
      { key: 'causalPair', minLength: 5, weight: 20 },
      { key: 'mechanism', minLength: 16, weight: 20 },
      { key: 'evidence', minLength: 12, weight: 20 },
      { key: 'revision', minLength: 12, weight: 20 }
    ];
    
    var totalScore = 0;
    fields.forEach(function(field) {
      var text = normalized[field.key] || '';
      if (text.length >= field.minLength) {
        totalScore += field.weight;
      } else if (text.length > 0) {
        // Parcial: proporcional ao tamanho mínimo
        totalScore += field.weight * (text.length / field.minLength);
      }
    });
    
    return Math.round(totalScore);
  },

  /**
   * Busca par causal similar usando distância de edição simples.
   * @private
   */
  findSimilarPair_: function (input, allowedPairs) {
    if (!input || allowedPairs.length === 0) return null;
    
    var normalized = input.toUpperCase().replace(/\s+/g, ' ').trim();
    var matches = allowedPairs.filter(function(pair) {
      var pairNormalized = pair.toUpperCase().replace(/\s+/g, ' ').trim();
      return pairNormalized.indexOf(normalized) !== -1 || 
             normalized.indexOf(pairNormalized) !== -1;
    });
    
    return matches.length > 0 ? matches[0] : null;
  },

  /**
   * Salva rascunho de evidência pedagógica em propriedade durável, usando o
   * cache somente como fallback quando PropertiesService não estiver disponível.
   * @param {string} userId
   * @param {number} levelId
   * @param {!Object} draft
   * @return {!Object}
   */
  saveDraft: function (userId, levelId, draft) {
    var cacheKey = 'learningDraft:' + userId + ':' + levelId;
    var level = GameConstants.getLevel(levelId);
    if (!level) throw Errors.validation('Nivel inexistente: ' + levelId);
    var validation = LearningJournalService.validate(
      level,
      draft, 
      false
    );
    
    var draftData = {
      userId: userId,
      levelId: levelId,
      draft: validation.normalized,
      completeness: validation.completeness,
      savedAt: Utils.nowIso(),
      warnings: validation.warnings,
      suggestions: validation.suggestions
    };
    
    var serialized = JSON.stringify(draftData);
    var persisted = false;
    try {
      if (typeof PropertiesService !== 'undefined') {
        PropertiesService.getScriptProperties().setProperty(
          LearningJournalService.draftPropertyKey_(userId, levelId),
          serialized
        );
        persisted = true;
      }
    } catch (propertyError) {
      try {
        AppLogger.warn('Falha ao persistir rascunho pedagógico.', {
          userId: userId,
          levelId: levelId,
          error: propertyError.message
        });
      } catch (_) {}
    }

    if (!persisted) {
      try {
        CacheService.getScriptCache().put(
          cacheKey,
          serialized,
          LearningJournalService.DRAFT_CACHE_TTL_SECONDS
        );
      } catch (cacheError) {
        try {
          AppLogger.warn('Falha ao salvar rascunho pedagógico.', {
            userId: userId,
            levelId: levelId,
            error: cacheError.message
          });
        } catch (_) {}
      }
    }
    
    return draftData;
  },

  /**
   * Recupera rascunho salvo.
   * @param {string} userId
   * @param {number} levelId
   * @return {?Object}
   */
  getDraft: function (userId, levelId) {
    var cacheKey = 'learningDraft:' + userId + ':' + levelId;
    var cached = null;
    try {
      if (typeof PropertiesService !== 'undefined') {
        cached = PropertiesService.getScriptProperties().getProperty(
          LearningJournalService.draftPropertyKey_(userId, levelId)
        );
      }
    } catch (_) {}

    if (!cached) {
      try {
        cached = CacheService.getScriptCache().get(cacheKey);
      } catch (_) {
        cached = null;
      }
    }
    
    if (!cached) return null;
    
    try {
      return JSON.parse(cached);
    } catch (parseError) {
      AppLogger.warn('Rascunho corrompido.', {
        userId: userId,
        levelId: levelId
      });
      return null;
    }
  },

  /**
   * Persiste evidência pedagógica validada com modo estrito.
   */
  record: function (userId, gameSession, level, learning, result, finalScore) {
    var validation = LearningJournalService.validate(level, learning, true);
    
    if (!validation.valid) {
      throw Errors.validation('Evidência pedagógica incompleta: ' + 
                            validation.warnings.join('; '));
    }
    
    var existing = CrudService.findOne(Config.SHEETS.LEARNING_JOURNALS, {
      userId: userId,
      gameId: gameSession.gameId
    });
    
    if (existing) return existing;

    return CrudService.create(Config.SHEETS.LEARNING_JOURNALS, {
      userId: userId,
      gameId: gameSession.gameId,
      levelId: level.id,
      city: level.city,
      prediction: validation.normalized.prediction,
      causalPair: validation.normalized.causalPair,
      mechanism: validation.normalized.mechanism,
      evidence: validation.normalized.evidence,
      revision: validation.normalized.revision,
      completed: result.completed === true,
      score: finalScore,
      completeness: validation.completeness
    });
  },

  /**
   * Histórico de aprendizagem do estudante.
   * @param {string} userId
   * @param {number=} limit
   * @return {!Array<!Object>}
   */
  getHistory: function (userId, limit) {
    var entries = CrudService.findBy(Config.SHEETS.LEARNING_JOURNALS, { userId: userId });
    var sorted = entries.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    var maxEntries = Math.max(1, Math.min(50, Utils.toInt(limit, 20)));
    return sorted.slice(0, maxEntries);
  },

  text_: function (value, maxLength) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      throw Errors.validation('Campo textual da evidencia invalido.');
    }
    return Utils.str(value).trim().substring(0, maxLength);
  }
};
