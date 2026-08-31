// Script executado automaticamente pelo GitHub Actions todo dia.
// Consulta os itens da Agenda Pessoal com data = hoje e status = pendente,
// e envia um lembrete via Telegram.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function faltaVariavel(nome, valor){
  if(!valor){
    console.error(`Variável de ambiente ausente: ${nome}. Verifique os Secrets do repositório.`);
    process.exit(1);
  }
}
faltaVariavel('SUPABASE_URL', SUPABASE_URL);
faltaVariavel('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
faltaVariavel('TELEGRAM_BOT_TOKEN', TELEGRAM_BOT_TOKEN);
faltaVariavel('TELEGRAM_CHAT_ID', TELEGRAM_CHAT_ID);

function hojeBrasil(){
  // Calcula a data de "hoje" já no fuso de Brasília (UTC-3, sem horário de verão),
  // já que o GitHub Actions roda os servidores em UTC.
  const agora = new Date();
  const offsetBrasilMs = -3 * 60 * 60 * 1000;
  const localBrasil = new Date(agora.getTime() + offsetBrasilMs);
  const y = localBrasil.getUTCFullYear();
  const m = String(localBrasil.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localBrasil.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TIPO_LABEL = {
  compromisso: '📅 Compromisso',
  lembrete: '🔔 Lembrete',
  tarefa: '✅ Tarefa'
};

async function buscarItensDeHoje(){
  const hoje = hojeBrasil();
  const url = `${SUPABASE_URL}/rest/v1/agenda_items?data=eq.${hoje}&status=eq.pendente&select=*&order=horario.asc`;
  const resp = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if(!resp.ok){
    const texto = await resp.text();
    throw new Error(`Erro ao consultar Supabase (${resp.status}): ${texto}`);
  }
  return resp.json();
}

function montarMensagem(itens){
  const linhas = [`📌 *Agenda de hoje (${hojeBrasil().split('-').reverse().join('/')})*`, ''];
  itens.forEach(it=>{
    const label = TIPO_LABEL[it.tipo] || it.tipo;
    const horario = it.horario ? ` — ${it.horario.slice(0,5)}` : '';
    linhas.push(`${label}${horario}: ${it.titulo}`);
    if(it.descricao){
      linhas.push(`   ${it.descricao}`);
    }
  });
  return linhas.join('\n');
}

async function enviarTelegram(texto){
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: texto,
      parse_mode: 'Markdown'
    })
  });
  const data = await resp.json();
  if(!data.ok){
    throw new Error(`Erro ao enviar mensagem no Telegram: ${JSON.stringify(data)}`);
  }
}

async function main(){
  const itens = await buscarItensDeHoje();
  if(itens.length === 0){
    console.log('Nenhum item pendente para hoje. Nenhuma mensagem enviada.');
    return;
  }
  const mensagem = montarMensagem(itens);
  await enviarTelegram(mensagem);
  console.log(`Lembrete enviado com ${itens.length} item(ns).`);
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
