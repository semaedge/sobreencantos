/**
 * Diretor de experiência de Sobre Encantos.
 * Inspirado em ZQuestClassic (capítulos/estado), Unciv (decisões por rodada)
 * e GCompris (andaimes e evidência formativa). Funções puras e determinísticas.
 *
 * Estrutura de fases:
 *   Fase 1 — Exploração (cap. 1–2): decisão binária clara, estado generoso.
 *   Fase 2 — Tensão     (cap. 3–4): 3 opções com trade-offs reais.
 *   Fase 3 — Crise      (cap. 5–6): decisões encadeadas, estado pressionado.
 */
var EXPERIENCE_GAME_ = {
  id: "sobre-encantos",
  title: "Sobre Encantos",
  sharedResource: "leitura crítica do território",
  chapters: [
    // ── FASE 1 · Exploração ──────────────────────────────────────────────────
    { id: "observar", order: 1, phase: 1, constraint: null,
      title: "Cartas do vento",
      situation: "Durante o voo, paisagens e palavras revelam pistas. A missão é observar atentamente antes de concluir.",
      decisions: [
        { id: "coletar",   label: "Coletar pistas da paisagem e registrar notas de campo", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "acelerar",  label: "Priorizar velocidade de voo e ignorar pistas",         delta: { knowledge: -1, cooperation: 0, pressure: 2 } }
      ]
    },
    { id: "rio-mudou", order: 2, phase: 1, constraint: null,
      title: "O rio que mudou de cor",
      situation: "Uma tonalidade diferente na água surge no trajeto. É um fenômeno natural da estação ou ação antrópica recente?",
      decisions: [
        { id: "investigar", label: "Consultar registros históricos e comparar fotos do leito", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "ignorar",    label: "Seguir em frente assumindo que a água sempre foi assim",    delta: { knowledge: -1, cooperation: 0, pressure: 2 } }
      ]
    },

    // ── FASE 2 · Tensão ──────────────────────────────────────────────────────
    { id: "relacionar", order: 3, phase: 2, constraint: "Visibilidade reduzida: neblina sobre o vale exige cooperação intensa da tripulação.",
      title: "Pontes de causa e consequência",
      situation: "Uma palavra não é inimiga: ela pede que o grupo investigue uma relação socioambiental complexa.",
      decisions: [
        { id: "comparar",   label: "Comparar causa, efeito e uma possível mediação local", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "simplificar", label: "Aceitar uma relação de causa única e automática",       delta: { knowledge: -1, cooperation: -1, pressure: 1 } },
        { id: "comunidade",  label: "Ouvir moradores ribeirinhos antes de traçar a hipótese", delta: { knowledge: 1, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "vozes-mapa", order: 4, phase: 2, constraint: "Informações divergentes: os mapas antigos e recentes apontam limites diferentes.",
      title: "A voz que não aparece no mapa",
      situation: "Certos grupos tradicionais e nascentes não estão representados na cartografia oficial do distrito.",
      decisions: [
        { id: "fontes-orais", label: "Cruzar cartografia oficial com mapeamento social e oral",   delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "oficial-so",   label: "Utilizar apenas o mapa oficial para evitar divergências",   delta: { knowledge: -1, cooperation: -2, pressure: 2 } },
        { id: "nova-camada",  label: "Criar uma camada participativa de anotações abertas",        delta: { knowledge: 1, cooperation: 2, pressure: 0 } }
      ]
    },

    // ── FASE 3 · Crise ───────────────────────────────────────────────────────
    { id: "narrar", order: 5, phase: 3, constraint: "Publicação iminente: a crônica territorial será lida na assembleia comunitária amanhã.",
      title: "O mapa ganha novas vozes",
      situation: "A turma cria uma pequena crônica territorial distinguindo fato, hipótese e proposta de ação comunitária.",
      decisions: [
        { id: "registrar",   label: "Narrar distinguindo evidência sólida de incerteza",        delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "pontuar",     label: "Resumir o percurso apenas pela pontuação de acertos",      delta: { knowledge: -2, cooperation: 0, pressure: 1 } },
        { id: "conciliar",   label: "Propor uma síntese que explicita as contradições vivas",   delta: { knowledge: 1, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "crise-interpretacao", order: 6, phase: 3, constraint: "Decisão final coletiva: o relatório de encantos precisa ser assinado por todos.",
      title: "Crise de interpretação territorial",
      situation: "Dois relatos contraditórios sobre o impacto de uma obra local exigem síntese ponderada sem apagar controvérsias.",
      decisions: [
        { id: "ressalvas",   label: "Publicar relatório conjunto com ressalvas e dados abertos", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "postergar",   label: "Aguardar mais dados indefinidamente sem emitir parecer",    delta: { knowledge: 0, cooperation: -1, pressure: 2 } },
        { id: "apresentar-ambos", label: "Apresentar ambas as teses como hipóteses em debate",  delta: { knowledge: 1, cooperation: 2, pressure: -1 } }
      ]
    },

    // ── FASE 4 · Memória Viva ──────────────────────────────────────────────────
    { id: "registro-tradicao", order: 7, phase: 4, constraint: "Registro sensível: as histórias orais devem respeitar a voz autêntica dos contadores.",
      title: "A galeria dos saberes encantados",
      situation: "O grupo decide registrar os relatos dos anciãos da região em um acervo sonoro e ilustrado para a biblioteca comunitária.",
      decisions: [
        { id: "acervo-comunitario", label: "Gravar as narrativas preservando o dialeto regional e os significados ecológicos", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "adaptacao-comercial", label: "Alterar as lendas para criar produtos comerciais de venda rápida", delta: { knowledge: -1, cooperation: -2, pressure: 2 } },
        { id: "sarau-intergeracional", label: "Organizar uma roda de fogueira com contação de causos e mediação de leitura", delta: { knowledge: 2, cooperation: 3, pressure: -1 } }
      ]
    },
    { id: "festa-encantamento", order: 8, phase: 4, constraint: "Celebração perene: o festival de salvaguarda deve unir arte, memória e conservação.",
      title: "O grande festival dos encantos",
      situation: "A escola e a comunidade celebram a aliança de proteção cultural e ambiental das florestas e águas locais.",
      decisions: [
        { id: "festival-permanente", label: "Consagrar o festival anual como espaço de vivência e proteção contínua do bioma", delta: { knowledge: 2, cooperation: 3, pressure: -1 } },
        { id: "fechar-acervo", label: "Guardar os registros em cofre e proibir novas interpretações pelos alunos", delta: { knowledge: -2, cooperation: -3, pressure: 2 } },
        { id: "trilha-interpretativa", label: "Criar uma trilha sensorial na mata com placas poéticas feitas pelos estudantes", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    }
  ]
};

function experienceNumber_(value, fallback) {
  if (value === null || value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (typeof value !== 'number' && typeof value !== 'string')) {
    return fallback;
  }
  var number = Number(value);
  return isFinite(number) ? number : fallback;
}

function experienceClamp_(value) {
  return Math.max(0, Math.min(10, experienceNumber_(value, 0)));
}

function getExperienceChapter(chapterId, year) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var schoolYear = Math.max(1, Math.min(5, experienceNumber_(year, 3)));
  var phaseLabels = { 1: 'Exploração', 2: 'Tensão', 3: 'Crise', 4: 'Memória Viva' };
  return {
    success: true,
    data: {
      gameId:         EXPERIENCE_GAME_.id,
      title:          chapter.title,
      situation:      chapter.situation,
      sharedResource: EXPERIENCE_GAME_.sharedResource,
      phase:          chapter.phase,
      phaseLabel:     phaseLabels[chapter.phase] || 'Exploração',
      constraint:     chapter.constraint || null,
      totalChapters:  EXPERIENCE_GAME_.chapters.length,
      decisions: chapter.decisions.map(function (item) { return { id: item.id, label: item.label }; }),
      cycle: {
        prediction:  schoolYear <= 2 ? 'Desenhe ou conte o que você acha que vai acontecer.' : 'Registre sua previsão e a evidência que pretende observar.',
        observation: 'O que mudou depois da escolha? Use um dado, sinal ou acontecimento do jogo.',
        explanation: 'Como a decisão contribuiu para esse resultado?',
        revision:    'O que o grupo manteria ou mudaria na próxima rodada?'
      },
      support: schoolYear <= 2 ? 'Leitura em voz alta, ícones e resposta oral.' : 'Tabela comparativa, pausa e papéis cooperativos.'
    }
  };
}

function resolveExperienceDecision(state, chapterId, decisionId, evidence) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var decision = chapter.decisions.filter(function (item) {
    return item.id === String(decisionId || '');
  })[0];
  if (!decision) return { success: false, error: 'Escolha não reconhecida para este capítulo.' };
  var current = state || {};
  var next = {
    chapter:     Math.min(EXPERIENCE_GAME_.chapters.length,
                          experienceNumber_(current.chapter, chapter.order) + 1),
    knowledge:   experienceClamp_(experienceNumber_(current.knowledge, 5) +
                                  decision.delta.knowledge),
    cooperation: experienceClamp_(experienceNumber_(current.cooperation, 5) +
                                  decision.delta.cooperation),
    pressure:    experienceClamp_(experienceNumber_(current.pressure, 2) +
                                  decision.delta.pressure)
  };
  var balance = next.knowledge + next.cooperation - next.pressure;
  return {
    success:   true,
    gameId:    EXPERIENCE_GAME_.id,
    choice:    { id: decision.id, label: decision.label },
    phase:     chapter.phase,
    previousState: {
      knowledge:   experienceClamp_(experienceNumber_(current.knowledge, 5)),
      cooperation: experienceClamp_(experienceNumber_(current.cooperation, 5)),
      pressure:    experienceClamp_(experienceNumber_(current.pressure, 2))
    },
    nextState:   next,
    consequence: balance >= 8
      ? 'A decisão ampliou a capacidade do grupo de compreender e cuidar de ' + EXPERIENCE_GAME_.sharedResource + '.'
      : balance >= 4
      ? 'A decisão equilibrou visões e desvelou nuances do território sob investigação.'
      : 'A decisão resolveu parte da questão, mas gerou divergências que demandam escuta atenta.',
    evidence:    String(evidence || '').trim().substring(0, 420),
    reflection:  getExperienceChapter(chapterId, 3).data.cycle.revision,
    complete:    chapter.order >= EXPERIENCE_GAME_.chapters.length
  };
}

/**
 * Calcula o desfecho final com base no estado acumulado de Sobre Encantos.
 */
function getExperienceEndgame(state) {
  var s = state || {};
  var k = experienceClamp_(experienceNumber_(s.knowledge, 5));
  var c = experienceClamp_(experienceNumber_(s.cooperation, 5));
  var p = experienceClamp_(experienceNumber_(s.pressure, 2));
  var balance = k + c - p;
  var route, title, summary, recommendation;
  if (balance >= 10) {
    route          = 'equilibrado';
    title          = 'Território em Harmonia Crítica';
    summary        = 'O grupo construiu uma leitura sólida e coletiva do território, valorizando todas as vozes e evidências sem sucumbir à pressa.';
    recommendation = 'Organize uma exposição da crônica territorial para a comunidade escolar.';
  } else if (p >= 7) {
    route          = 'sobrecarga';
    title          = 'Mapeamento sob Pressão';
    summary        = 'A pressa e as cobranças de prazo tensionaram a equipe, gerando análises fragmentadas.';
    recommendation = 'Reflita sobre os momentos em que a velocidade foi priorizada em detrimento da escuta comunitária.';
  } else {
    route          = 'fragmentado';
    title          = 'Cartografia Dissociada';
    summary        = 'Conhecimento técnico e cooperação social avançaram em ritmos desiguais, deixando lacunas na narrativa territorial.';
    recommendation = 'Retome os capítulos 3 e 4 para reavaliar as pontes de causa e efeito propostas.';
  }
  return {
    success:        true,
    gameId:         EXPERIENCE_GAME_.id,
    route:          route,
    title:          title,
    summary:        summary,
    recommendation: recommendation,
    finalState:     { knowledge: k, cooperation: c, pressure: p, balance: balance }
  };
}

/**
 * Workflow mínimo compartilhado: orientar → prever → decidir → observar →
 * refletir. O estado retornado é serializável e pode ser salvo pelo cliente.
 */
function getExperienceBasicWorkflow(year) {
  var first = EXPERIENCE_GAME_.chapters[0];
  return {
    success: true,
    data: {
      gameId:    EXPERIENCE_GAME_.id,
      title:     EXPERIENCE_GAME_.title,
      chapterId: first.id,
      stage:     'briefing',
      stages:    ['briefing', 'prediction', 'decision', 'observation', 'reflection'],
      briefing:  getExperienceChapter(first.id, year).data,
      state:     { chapter: 1, knowledge: 5, cooperation: 5, pressure: 2 },
      complete:  false
    }
  };
}

function advanceExperienceBasicWorkflow(workflow, input, year) {
  var current = workflow && workflow.data ? workflow.data : workflow;
  if (!current || current.gameId !== EXPERIENCE_GAME_.id) {
    current = getExperienceBasicWorkflow(year).data;
  }
  var payload = input || {};
  var stages  = ['briefing', 'prediction', 'decision', 'observation', 'reflection'];
  var stage   = current.stage || 'briefing';
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(current.chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];

  // Verificação de pré-requisito na transição entre fases
  if (stage === 'briefing' && chapter.phase > 1) {
    var prevIdx     = chapter.order - 2;
    var prevChapter = prevIdx >= 0 ? EXPERIENCE_GAME_.chapters[prevIdx] : null;
    if (prevChapter && prevChapter.phase < chapter.phase &&
        experienceNumber_((current.state || {}).knowledge, 5) < 3) {
      return {
        success:     true,
        needsReview: true,
        message:     'O grupo precisa consolidar os conhecimentos da fase anterior antes de avançar. Revise suas reflexões de campo.',
        data:        current
      };
    }
  }

  var next = {
    gameId:      EXPERIENCE_GAME_.id,
    title:       EXPERIENCE_GAME_.title,
    chapterId:   chapter.id,
    stage:       stage,
    stages:      stages.slice(),
    briefing:    getExperienceChapter(chapter.id, year).data,
    state:       current.state || { chapter: chapter.order, knowledge: 5, cooperation: 5, pressure: 2 },
    prediction:  String(current.prediction  || ''),
    observation: String(current.observation || ''),
    reflection:  String(current.reflection  || ''),
    lastResult:  current.lastResult || null,
    complete:    false
  };

  if (stage === 'briefing') {
    next.stage = 'prediction';
  } else if (stage === 'prediction') {
    next.prediction = String(payload.text || payload.prediction || '').trim().substring(0, 420);
    if (!next.prediction) return { success: false, error: 'Registre uma previsão antes de decidir.', data: next };
    next.stage = 'decision';
  } else if (stage === 'decision') {
    var result = resolveExperienceDecision(next.state, chapter.id, payload.decisionId, payload.evidence);
    if (!result.success) return { success: false, error: result.error, data: next };
    next.state      = result.nextState;
    next.lastResult = result;
    next.stage      = 'observation';
  } else if (stage === 'observation') {
    next.observation = String(payload.text || payload.observation || '').trim().substring(0, 420);
    if (!next.observation) return { success: false, error: 'Registre uma evidência observada.', data: next };
    next.stage = 'reflection';
  } else {
    next.reflection = String(payload.text || payload.reflection || '').trim().substring(0, 420);
    if (!next.reflection) return { success: false, error: 'Registre o que manter ou revisar.', data: next };
    var nextChapter = EXPERIENCE_GAME_.chapters[chapter.order];
    if (!nextChapter) {
      next.complete = true;
      next.stage    = 'complete';
      next.endgame  = getExperienceEndgame(next.state);
    } else {
      next.chapterId   = nextChapter.id;
      next.stage       = 'briefing';
      next.briefing    = getExperienceChapter(nextChapter.id, year).data;
      next.prediction  = '';
      next.observation = '';
      next.reflection  = '';
    }
  }
  return { success: true, data: next };
}

