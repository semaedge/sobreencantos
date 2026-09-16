/**
 * Ping.gs
 * codex-frontend-backend-healthcheck
 *
 * Sonda de saude leve: confirma que o frontend alcanca o backend via
 * google.script.run.
 *
 * - Sem efeitos colaterais, sem dependencia de sessao ou planilha. E por isso
 *   que existe separado de healthCheck() (Code.gs), que abre a planilha e conta
 *   as linhas de cada aba: aquele diagnostica os dados, este so responde.
 * - Fica fora do ApiContract de proposito: nao e operacao do jogo, e sonda de
 *   infraestrutura, chamada direto por google.script.run.ping().
 */
function ping() {
  try {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'backend',
        time: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Erro em ping: ' + error.message);
    throw error;
  }
}
