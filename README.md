# Sobre Encantos — Backend

Núcleo do backend em Google Apps Script para o jogo descrito em
[Arquitetura_Projeto_Jetpack_Brasil.md](Arquitetura_Projeto_Jetpack_Brasil.md).

> Para executar o ciclo completo de mudança e entrega, comece por
> [WORKFLOW_BASICO.md](WORKFLOW_BASICO.md).

## O que está implementado

| Arquivo | Responsabilidade |
|---|---|
| [Config.gs](Config.gs) | Configuração global, nomes de abas e esquema de colunas |
| [GameConstants.gs](GameConstants.gs) | Física, pontuação, power-ups, inimigos, os pares didáticos e os 10 níveis (capitais) |
| [Utils.gs](Utils.gs) | Utilitários (uuid, coerção de tipos, clamp, sanitize) |
| [ErrorHandling.gs](ErrorHandling.gs) | `AppError`, códigos de erro e o envelope `{ok, data\|error}` |
| [Logger.gs](Logger.gs) | Log com níveis (`AppLogger`), opcionalmente na aba `Logs` |
| [SchemaService.gs](SchemaService.gs) | Acesso às abas, criação de cabeçalho, `withLock` |
| [CrudService.gs](CrudService.gs) | CRUD genérico sobre Sheets, com campos JSON |
| [AuthService.gs](AuthService.gs) | Registro, login, logout, troca de senha |
| [SessionManager.gs](SessionManager.gs) | Sessões persistentes com token em hash, cache, `requireSession`, `requireAdmin` |
| [UserService.gs](UserService.gs) | Perfil, moedas, remoção de usuário |
| [ProgressService.gs](ProgressService.gs) | Progresso, desbloqueio e seleção de níveis |
| [ScoreService.gs](ScoreService.gs) | Pontuações e estatísticas |
| [LeaderboardService.gs](LeaderboardService.gs) | Ranking global com cache versionado |
| [SettingsService.gs](SettingsService.gs) | Configurações por usuário, com validação |
| [GameSession.gs](GameSession.gs) | Ciclo da partida: `startGame` / `endGame` |
| [LearningJournalService.gs](LearningJournalService.gs) | Validação e persistência de hipótese, mecanismo, evidência e revisão por partida |
| [RemoteFunctions.gs](RemoteFunctions.gs) | API `api_*` chamada por `google.script.run` |
| [Code.gs](Code.gs) | `doGet`, `include`, `setup`, `createAdminUser`, `healthCheck` |
| [Tests.gs](Tests.gs) | 24 testes funcionais e de segurança (`runAllTests`) |

## Frontend

Aplicativo de página única: `doGet` serve apenas `Index.html`, e as telas são
`include()` exibidos por um roteador no cliente — cada navegação real custaria
um recarregamento do iframe do Apps Script.

| Arquivo | Responsabilidade |
|---|---|
| [Index.html](Index.html) | Shell; monta as telas via `include()` |
| [Stylesheet.html](Stylesheet.html) | CSS global, mobile-first |
| [JavaScript.html](JavaScript.html) | Cliente da API, roteador, telas, ciclo da partida |
| [Game.html](Game.html) | Motor: laço de passo fixo, física, colisão, render |
| [LoadingScreen.html](LoadingScreen.html) | Tela de carregamento |
| [Login.html](Login.html) | Login e registro no mesmo formulário |
| [MainMenu.html](MainMenu.html) | Menu com recorde, moedas e nível atual |
| [LevelSelection.html](LevelSelection.html) | Os 10 níveis, com bloqueio vindo do servidor |
| [GameScreen.html](GameScreen.html) | Canvas, HUD, pausa e fim de partida |
| [Leaderboard.html](Leaderboard.html) | Ranking global |
| [Settings.html](Settings.html) | Dificuldade, volumes e controles |
| [Debug.html](Debug.html) | Verificação crua da API, em `?page=Debug` |

Controles: toque, clique, espaço, seta para cima ou `W` para acionar o jetpack;
`Esc` pausa. O combustível queima enquanto sobe e regenera quando solta.

**Obstáculos-palavra.** Todo nível tem ao menos um par didático, declarado em
`words` na definição do nível (`GameConstants.gs`). O par vira uma placa
pendurada no teto com a primeira palavra; quando a placa chega perto do
jogador, ela cospe **uma única vez** a palavra associada, que voa na direção
dele. Ao mesmo tempo aparece a faixa `PALAVRA → PALAVRA` com a frase que
explica o vínculo — por exemplo `CORRUPÇÃO → ROUBO`. Desviar da palavra
cuspida vale `POINTS_PER_WORD_DODGE`; encostar nela ou na placa custa uma
vida. Os pares se distribuem ao longo do percurso, o primeiro antes da metade
do caminho.

**A autoridade é do servidor.** O cliente roda o laço a 60 passos por segundo
com passo fixo e envia o placar *bruto* em `api_endGame`; quem aplica o
multiplicador de dificuldade, o bônus de conclusão e o desbloqueio do próximo
nível é o backend, que também recusa nível não liberado e partida que não tenha
começado por ele. Cada início recebe um `gameId`, devolvido também no
encerramento ou abandono: uma resposta atrasada de uma partida anterior não
consegue encerrar a partida atual. O fim da partida já devolve perfil, progresso
e níveis sincronizados, portanto o menu não precisa buscar novamente os dados
que o servidor acabou de persistir.

**Caderno do território.** A partida só começa após uma hipótese. No fim, o
servidor exige uma relação pertencente ao nível, mecanismo causal, evidência e
revisão antes de aceitar pontuação ou progresso. O registro fica ligado à conta,
à partida e ao nível na aba `LearningJournals`. Consulte o
[incremento de maturidade de 15/08/2026](INCREMENTO_MATURIDADE_2026-08-15.md).

Os serviços de domínio da loja, inventário e conquistas já estão implementados
no backend e cobertos pelo harness. Ainda faltam a integração dessas regras com
as telas, além de tutoriais, cutscenes, editor de níveis, áudio e painel
administrativo.

## Comandos

Sem dependências — `npm install` não baixa nada, os scripts são Node puro.

```bash
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o preview jogável em `http://localhost:5173` |
| `npm test` | Roda `Tests.gs` fora do Apps Script (sai 1 se falhar) |
| `npm run maturity` | Auditoria de maturidade do backend |
| `npm run maturity:json` | Mesma auditoria em JSON, para CI |
| `npm run maturity:test` | Testa a própria auditoria contra regressões injetadas |
| `npm run project-maturity` | Consolida produto, backend, frontend, testes e operação |
| `npm run project-maturity:test` | Testa estágios, travas e evidências do consolidador |
| `npm run frontend-maturity` | Auditoria de maturidade e intuitividade do frontend |
| `npm run frontend-maturity:test` | Testa a auditoria do frontend |
| `npm run audit` | Contratos e auditorias de backend/frontend com notas mínimas |
| `npm run verify` | Gate completo: auditorias, testes do consolidador e maturidade do projeto |
| `npm run check` | Alias do gate completo `npm run verify` |

## Maturidade consolidada do projeto

[`project_maturity.py`](project_maturity.py) executa as auditorias de backend e
frontend e acrescenta dimensões que uma inspeção isolada não comprova:
completude do fluxo jogável, cobertura direta da API, comportamento observado no
navegador e prontidão de deployment. No estado atual, o código alcança
**92,2/100 e estágio 5 por pontuação**, mas o estágio efetivo permanece
**4 — Pré-piloto** enquanto runtime, execução real no Apps Script e deployment
não tiverem evidências recentes. A ferramenta separa prontidão do código de
validação operacional.

Para registrar verificações externas, passe `--evidence maturity-evidence.json`:

```json
{
  "optional_scope_accepted": true,
  "runtime_probe": {
    "passed": true,
    "score": 90,
    "verified_at": "2026-07-27T12:00:00Z"
  },
  "apps_script_tests_passed": {
    "passed": true,
    "verified_at": "2026-07-27T12:05:00Z"
  },
  "deployment_verified": {
    "verified": true,
    "verified_at": "2026-07-27T12:10:00Z",
    "deployment_id": "ID_DA_IMPLANTACAO"
  }
}
```

O estágio 5 exige nota mínima de 92 e essas três evidências com `verified_at`
dos últimos 30 dias; presença de arquivos, booleanos sem data ou comentários
não é aceita como prova operacional.

## Ferramenta de maturidade

[dev/maturity.js](dev/maturity.js) audita o backend em seis dimensões com pesos
diferentes e devolve nota de 0 a 100 mais um nível de 1 a 5. **Cada verificação
mede algo**: lê o código-fonte ou executa o backend real no harness e observa o
resultado. Nenhuma delas apenas repete uma opinião — se não dá para medir, não
entra.

| Dimensão | Peso | Exemplos de verificação |
|---|---|---|
| Segurança | 1,5 | registra uma conta e procura a senha em claro na aba; chama função de admin com conta comum e exige `FORBIDDEN`; compara a mensagem de senha errada com a de usuário inexistente |
| Integridade de dados | 1,3 | confirma `withLock` nas escritas; compara o cabeçalho real das abas com o esquema; remove um usuário e conta linhas órfãs; grava JSON corrompido e verifica que a leitura resiste |
| Testes | 1,2 | roda `runAllTests()`; mede quantas `api_*` aparecem em `Tests.gs`; procura resíduo deixado na planilha |
| Capacidades | 1,0 | módulos de núcleo presentes; serviços de negócio do documento; cobertura do documento de arquitetura |
| Superfície da API | 1,0 | toda `api_*` usa `Errors.wrap`; toda função autenticada recusa token inválido; nenhuma resposta expõe a senha |
| Observabilidade | 0,8 | `healthCheck` responde; erro inesperado vira `INTERNAL_ERROR` sem vazar a mensagem original |

**Travas.** Média esconde controle crítico ausente, então algumas falhas limitam
o nível independentemente da nota — senha em claro trava no nível 2, bypass de
autenticação ou vazamento de senha trava no nível 1. Hoje o backend tira **93 de
100 e alcança o nível 5**; senhas novas recebem hash iterativo com salt e contas
legadas são migradas no primeiro login bem-sucedido.

**A auditoria é testada.** [dev/maturity.test.js](dev/maturity.test.js) copia
os fontes de `webapp/` para uma pasta temporária, injeta nove regressões reais — uma `api_` sem
`Errors.wrap`, `requireSession` removido, `requireAdmin` trocado por
`requireSession`, escrita sem lock, senha vazando em `toPublicProfile`, limpeza
incompleta de usuário, detalhe interno vazando no erro, teste quebrado — e exige
que a auditoria pegue cada uma. Sem isso não há como saber se a ferramenta
dispara.

Opções: `--json`, `--min=NN` (sai 1 abaixo da nota), `--dim=seguranca` (uma
dimensão só), `--src=caminho` (audita outra cópia do backend).

## Ferramenta de maturidade e intuitividade do frontend

Duas camadas, porque metade do que importa num frontend só existe depois de
renderizar. As duas pontuam pelo mesmo núcleo
([dev/maturity-core.js](dev/maturity-core.js)) e usam as mesmas travas.

**Sobre a palavra "intuitividade":** ninguém mede intuitividade sem gente na
frente da tela. O que dá para medir são proxies objetivos, e é só isso que
entra — rótulo ligado ao campo, contraste calculado, ortografia, tela sem beco
sem saída, retorno visível enquanto o servidor responde, tamanho real do alvo de
toque.

### Camada estática — `npm run frontend-maturity`

[dev/frontend-maturity.js](dev/frontend-maturity.js) trabalha sobre a página com
os `include()` já resolvidos, ou seja, exatamente o que o navegador recebe.

| Dimensão | Peso | Exemplos |
|---|---|---|
| Acessibilidade | 1,3 | `<label for>` em cada campo; nome acessível em cada botão; **contraste WCAG calculado** para cada par de cores do tema; estilo de `:focus` |
| Estrutura | 1,2 | nenhum `id` repetido na página montada; todo id buscado por `$()`, `texto()` ou `aviso()` existe; rotas e telas casam nos dois sentidos |
| Clareza | 1,2 | **acentuação do texto de interface**; rótulos de botão específicos |
| Robustez | 1,2 | sem `alert`/`confirm`/`prompt`; `innerHTML` sem interpolação; rejeição de promessa tratada |
| Navegação | 1,1 | nenhuma tela é beco sem saída; jogo controlável por teclado |

### Camada de tempo de execução — `npm run dev`, depois `/audit`

[dev/frontend-probe.js](dev/frontend-probe.js) roda dentro do preview e **dirige
a interface como um usuário**: preenche campo, clica, espera. Injeta 1200 ms de
latência artificial em cada chamada — sem latência é impossível observar se a
tela diz algo enquanto o servidor pensa.

Ela não tem atalho para dentro do aplicativo: `JavaScript.html` é um IIFE
fechado, e a sonda só alcança o DOM, os globais do backend em memória e o
`localStorage`. Isso é proposital — se ela só consegue o que um usuário consegue,
mede a experiência, não a implementação.

Mede: retorno visível dentro de 400 ms do clique; três cliques rápidos gerando
uma única requisição; erro do servidor aparecendo na tela e não só no console;
sessão expirada devolvendo ao login com explicação; altura real de cada alvo de
toque; rolagem horizontal; toques necessários até jogar; console limpo no fim do
percurso.

### As duas auditorias são testadas

[dev/frontend-maturity.test.js](dev/frontend-maturity.test.js) injeta nove
defeitos em cópias dos fontes e exige detecção. Dois cenários vão no sentido
contrário: partem de um critério que o código atual **já cumpre** — contraste e
acentuação — e exigem que a auditoria comece a acusar quando ele é desfeito. Sem
esses dois não haveria prova de que os veredictos vêm da medição e não de uma
constante escrita no código.

## Rodando localmente, sem deploy

`dev/` monta uma página única com o frontend real e o backend real: os `.gs`
executam no navegador sobre um substituto em memória de Sheets, Properties,
Cache e Lock, e `google.script.run` passa a chamar as `api_*` locais.

Abra `http://localhost:5173` (via `npm run dev`) e entre com `jogador1` /
`senha1234`. O servidor
regera a página a cada carregamento, então basta editar um arquivo de `webapp/` e
recarregar. Três contas rivais são semeadas para o ranking não nascer vazio.

Isso **não** substitui o teste no App da Web: aqui a planilha e a sessão vivem
em memória e desaparecem ao recarregar. `dev/` fica fora dos fontes, então o
`clasp` não envia nada disso.

## Instalação

1. Crie um projeto em [script.google.com](https://script.google.com) e envie o
   conteúdo de `webapp/` — os `.gs` e `.html` da raiz (via `clasp push` ou copiando os arquivos no editor —
   `.gs` como Script, os `.html` como HTML, mantendo os nomes).
2. Rode `setup()` uma vez no editor. Ele cria a planilha de dados, grava o
   `SPREADSHEETS_ID` nas Propriedades do Script e monta as abas `Users`,
   `Progress`, `Scores`, `Settings` e `Logs`.
3. Rode `runAllTests()` e confira o log: 24 passaram, 0 falharam.
4. Nas Propriedades do Script, defina temporariamente
   `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD` e, se necessário,
   `BOOTSTRAP_ADMIN_EMAIL`; rode `createAdminUser()`. A propriedade da senha é
   apagada depois da criação.
5. **Implantar → Nova implantação → App da Web** (executar como você, acesso
   conforme necessário). A URL abre o jogo; `?page=Debug` abre a página de
   verificação da API.

Com `clasp`, copie `.clasp.json.example` para `.clasp.json`, informe o projeto
correto e confira o vínculo antes de enviar:

```bash
clasp status
clasp push
```

## Contrato da API

Toda função `api_*` devolve um envelope — nunca lança para o cliente:

```js
{ ok: true,  data: { ... } }
{ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Campo obrigatorio: senha.' } }
```

Códigos: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `UNAUTHORIZED`,
`FORBIDDEN`, `INTERNAL_ERROR`.

Funções autenticadas recebem o token como primeiro argumento:

```js
google.script.run
  .withSuccessHandler(function (res) { if (res.ok) mostrarRanking(res.data); })
  .api_getLeaderboard(10);
```

| Função | Autenticada | Retorno |
|---|---|---|
| `api_register(usuario, senha, email?)` | não | perfil público |
| `api_login(usuario, senha)` | não | `{token, expiresAt, user}` |
| `api_logout(token)` | sim | `true` |
| `api_validateSession(token)` | não | `{valid}` |
| `api_changePassword(token, atual, nova)` | sim | `true` |
| `api_getProfile(token)` | sim | perfil + progresso + recorde |
| `api_updateProfile(token, {email})` | sim | perfil público |
| `api_getGameData()` | não | níveis, física, inimigos, power-ups |
| `api_getLevelSelection(token)` | sim | níveis com `unlocked`/`completed` |
| `api_startGame(token, nivel)` | sim | dados de inicialização do nível |
| `api_endGame(token, resultado)` | sim | pontuação final, moedas, progresso, rank e estado sincronizado |
| `api_abandonGame(token, gameId)` | sim | `true` |
| `api_getProgress(token)` | sim | progresso |
| `api_saveProgress(token, dados)` | sim | seleção de nível e checkpoint; campos autoritativos são recusados |
| `api_getLeaderboard(limite?, nivel?)` | não | ranking |
| `api_getMyStats(token)` | sim | estatísticas + rank + partidas recentes |
| `api_getSettings(token)` | sim | configurações |
| `api_saveSettings(token, mudanças)` | sim | configurações |
| `api_adminGetDashboard(token)` | admin | totais e top 10 |

## Decisões que valem registro

- **Senhas com hash e migração gradual.** Contas novas usam SHA-256 iterativo
  com salt individual; contas legadas em texto plano são reconhecidas somente
  para um login válido e regravadas imediatamente no formato seguro.
- **Validação no servidor**, não no cliente: `api_startGame` recusa nível
  bloqueado, `api_endGame` exige partida aberta pelo backend e aplica o
  multiplicador de dificuldade, `ScoreService` rejeita pontuação implausível.
  O cliente é a fonte do gameplay, não da autoridade.
- **Escritas sob `LockService`** (`SheetManager.withLock`), porque duas
  execuções simultâneas em Sheets corrompem linhas silenciosamente.
- **Sessões duráveis com cache de leitura.** O token utilizável nunca é gravado:
  a aba `Sessions` guarda somente seu SHA-256. O `CacheService` acelera as
  leituras, mas uma entrada descartada é reconstruída da planilha até o prazo
  de expiração. Trocar a senha encerra as outras sessões da conta.
- **Ranking em cache com versão no nome da chave**, para invalidar sem varrer
  todas as combinações de limite e nível.
- **Balanceamento herdado do documento, não ajustado.** Com `SCROLL_SPEED` de
  4,5 px por quadro e 32 px por metro, o nível 1 (1.200 m) dura cerca de 2min20
  sem falhas — longo para um primeiro nível. O combustível também é apertado:
  4,7 s de subida contínua e 14 s para reencher. Os dois números vivem em
  `GameConstants.gs` e valem um ajuste depois de jogar.
- **`dev/preview.html` é gerado**, não editado à mão; `dev/serve.js` o regera a
  cada carregamento da página.
