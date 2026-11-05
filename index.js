'use strict';

try {
  require('dotenv').config();
} catch {
  /* dotenv é opcional: o token pode ficar neste arquivo */
}

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

// ============================================================================
// Constantes
// ============================================================================
// Token do bot. Mantenha este arquivo privado: quem tiver o token controla o bot.
const TOKEN_DO_BOT = 'MTU2NjQ5NzE3Nzk2NDkwNDUzOA.GLuege.rew7lsizhOWXkaLofE_81e9VARXP2msqXUb47A';
const TOKEN = TOKEN_DO_BOT || process.env.DISCORD_TOKEN;
const CONFIG_FILE = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');
const CAPACIDADE_PADRAO = 20;
const CAPACIDADE_MAXIMA = 100;
const EFEMERO = MessageFlags.Ephemeral;

const COR = {
  PRIMARIA: 0x5865f2,
  SUCESSO: 0x57f287,
  ERRO: 0xed4245,
};

/** Textos exibidos aos usuários, centralizados para facilitar ajustes. */
const MSG = {
  SEM_PERMISSAO: 'Você não tem permissão para utilizar este recurso.',
  SO_STAFF: 'Apenas managers e assistentes podem utilizar este comando.',
  SO_REGISTRAR: 'Apenas administradores, ou o manager que possui o cargo do time, podem registrar um time.',
  SO_REMOVER: 'Apenas administradores, ou o manager responsável pelo time, podem removê-lo.',
  MANAGER_NAO_CONFIGURADO: 'O cargo de manager ainda não foi configurado. Utilize o `/painel`.',
  CARGOS_NAO_CONFIGURADOS: 'Os cargos de manager e assistente ainda não foram configurados. Utilize o `/painel`.',
  FA_SEM_CANAL: 'O canal de Free Agency ainda não foi configurado. Contate a administração.',
  FA_SEM_PERMISSAO_CANAL: (canal) => `Não tenho permissão para enviar mensagens em ${canal}. Contate a administração.`,
  FA_ENVIADA: (canal) => `Sua Free Agency foi enviada em ${canal}.`,
  ROBLOX_INDISPONIVEL: 'Não foi possível consultar o Roblox no momento. Tente novamente em instantes.',
  ROBLOX_NAO_ENCONTRADO: 'Usuário do Roblox não encontrado. Verifique o nick informado e tente novamente.',
  CANAL_INVALIDO: 'Canal não encontrado.',
  CANAL_SEM_PERMISSAO: (canal) =>
    `Preciso das permissões **Ver Canal**, **Enviar Mensagens** e **Inserir Links** em ${canal}.`,
  CARGO_INVALIDO: 'Selecione um cargo válido. O @everyone não pode ser utilizado.',
  CAPACIDADE_INVALIDA: `Informe um número inteiro entre 1 e ${CAPACIDADE_MAXIMA}.`,
  CARGO_TIME_INVALIDO: 'Selecione o cargo do time. Não é possível usar o @everyone nem cargos de integração.',
  CARGO_EH_STAFF: 'Este cargo está definido como manager ou assistente. Selecione o cargo do time.',
  EMOJI_INVALIDO: 'Emoji inválido. Utilize um emoji padrão ou um emoji do servidor.',
  TIME_JA_REGISTRADO: 'Este cargo já está registrado como time.',
  TIME_NAO_REGISTRADO: 'Este cargo não corresponde a um time registrado.',
  SEM_TIME: 'Você não possui o cargo de nenhum time registrado.',
  MAIS_DE_UM_TIME: 'Você possui o cargo de mais de um time. Mantenha apenas o cargo do seu time.',
  MAIS_DE_UM_TIME_REMOVER: 'Você possui mais de um time. Informe o cargo no comando.',
  JOGADOR_AUSENTE: 'Este usuário não está no servidor.',
  JOGADOR_INVALIDO: 'Selecione outro jogador.',
  JOGADOR_JA_NO_TIME: (jogador, time) => `${jogador} já pertence ao time ${time}.`,
  JOGADOR_FORA_DO_TIME: (jogador) => `${jogador} não faz parte do seu time.`,
  RELEASE_STAFF: 'Não é possível remover managers ou assistentes por este comando.',
  TIME_LOTADO: (time, total, cap) => `O time ${time} atingiu a capacidade máxima (${total}/${cap}).`,
  DM_FECHADA: (jogador) => `Não foi possível enviar a mensagem privada para ${jogador}. Verifique se as mensagens diretas estão liberadas.`,
  CONTRATO_ENVIADO: (jogador) => `Proposta de contrato enviada para ${jogador}.`,
  CONTRATO_ALHEIO: 'Esta proposta não é destinada a você.',
  CONTRATO_JA_ACEITO: 'Você já aceitou esta proposta.',
  ERRO_GENERICO: 'Ocorreu um erro inesperado. Tente novamente.',
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ============================================================================
// Configuração (persistência por servidor em config.json)
//
// {
//   "<guild_id>": {
//     "free_agency_channel": "123",
//     "contracts_channel": "123",
//     "manager_role": "123",
//     "assistant_role": "123",
//     "roster_cap": 20,
//     "teams": {
//       "<id do cargo do time>": {
//         "cargo_id": "123", "nome": "Real Madrid", "emoji": "⚽",
//         "jogadores": ["123", "456"]
//       }
//     }
//   }
// }
//
// O time é um CARGO. Quem possui o cargo do time e o cargo de manager (ou de
// assistente) é o manager (ou assistente) daquele time. IDs são guardados
// como texto para não perder precisão.
// ============================================================================
function carregar() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    const texto = fs
      .readFileSync(CONFIG_FILE, 'utf-8')
      // IDs grandes viram texto antes da leitura (o JavaScript perde precisão
      // em números grandes). Isso também permite ler o config.json antigo.
      .replace(/(?<=[:[,]\s*)(\d{16,})(?=\s*[,\]}])/g, '"$1"');
    const dados = JSON.parse(texto);
    return dados && typeof dados === 'object' ? dados : {};
  } catch {
    return {};
  }
}

function salvar(dados) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(dados, null, 2), 'utf-8');
}

/** Garante a estrutura do servidor e converte formatos antigos. */
function normalizar(dados, guildId) {
  const chave = String(guildId);
  let g = dados[chave];
  if (g === null || typeof g !== 'object') {
    g = typeof g === 'string' || typeof g === 'number' ? { free_agency_channel: String(g) } : {};
  }

  for (const campo of ['free_agency_channel', 'contracts_channel', 'manager_role', 'assistant_role']) {
    if (g[campo] != null) g[campo] = String(g[campo]);
  }
  g.roster_cap = Number(g.roster_cap) || CAPACIDADE_PADRAO;

  // A chave de cada time é o ID do cargo. Times antigos sem cargo são descartados.
  const times = {};
  for (const t of Object.values(g.teams ?? {})) {
    if (!t || !t.cargo_id) continue;
    times[String(t.cargo_id)] = {
      cargo_id: String(t.cargo_id),
      nome: t.nome ?? '',
      emoji: t.emoji ?? '',
      jogadores: (t.jogadores ?? []).map(String),
    };
  }
  g.teams = times;

  dados[chave] = g;
  return g;
}

const carregarGuild = (guildId) => normalizar(carregar(), guildId);

function atualizarGuild(guildId, campos) {
  const dados = carregar();
  Object.assign(normalizar(dados, guildId), campos);
  salvar(dados);
}

// ============================================================================
// Domínio: cargos, times e contratos
// ============================================================================
const temCargo = (membro, cargoId) => cargoId != null && membro.roles.cache.has(String(cargoId));
const ehManager = (membro, g) => temCargo(membro, g.manager_role);
const ehStaff = (membro, g) => ehManager(membro, g) || temCargo(membro, g.assistant_role);

/** Times registrados cujo cargo o membro possui: [[chave, time], ...]. */
const timesDoMembro = (g, membro) =>
  Object.entries(g.teams).filter(([, time]) => membro.roles.cache.has(time.cargo_id));

/** Time em que o jogador foi contratado: [chave, time] ou [null, null]. */
function timeDoJogador(g, userId) {
  for (const [chave, time] of Object.entries(g.teams)) {
    if (time.jogadores.includes(String(userId))) return [chave, time];
  }
  return [null, null];
}

/** Nome do time em texto (usa o nome atual do cargo, quando existir). */
const nomeTime = (time, guild) => guild?.roles.cache.get(time.cargo_id)?.name ?? time.nome;

/** Emoji + menção do cargo (para mensagens dentro do servidor). */
const fmtTime = (time) => `${time.emoji} <@&${time.cargo_id}>`;

/** Emoji + nome em texto (para mensagens privadas, onde menções de cargo não aparecem). */
const fmtTimeTexto = (time, guild) => `${time.emoji} **${nomeTime(time, guild)}**`;

function emojiValido(emoji) {
  if (/^<a?:\w{2,32}:\d{15,25}>$/.test(emoji)) return true; // emoji customizado
  return /[^\x00-\x7F]/.test(emoji) && [...emoji].length <= 16; // emoji padrão
}

/** Valida e registra o jogador no time. Retorna [status, info]. */
function aceitarContrato(guildId, cargoId, playerId) {
  const dados = carregar();
  const g = normalizar(dados, guildId);

  const time = g.teams[String(cargoId)];
  if (!time) return ['sem_time', null];

  const [atual] = timeDoJogador(g, playerId);
  if (atual === String(cargoId)) return ['ja_aceito', null];
  if (atual !== null) return ['ja_em_time', null];

  if (time.jogadores.length >= g.roster_cap) return ['cheio', null];

  time.jogadores.push(String(playerId));
  salvar(dados);
  return ['ok', { time, total: time.jogadores.length, cap: g.roster_cap, canal: g.contracts_channel ?? null }];
}

/** Envia uma mensagem privada a um usuário. Falhas são ignoradas. */
async function enviarPrivado(userId, conteudo) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(conteudo);
  } catch {
    /* mensagens diretas fechadas ou usuário indisponível */
  }
}

// ============================================================================
// Roblox
// ============================================================================
class RobloxErro extends Error {}

/** Retorna os dados do usuário Roblox ou null se o nick não existir. */
async function buscarRoblox(nick) {
  try {
    const resp = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [nick], excludeBannedUsers: true }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new RobloxErro(`users API status ${resp.status}`);
    const dados = await resp.json();
    if (!dados.data?.length) return null;

    const usuario = dados.data[0];
    let avatar = null;
    const respAvatar = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${usuario.id}&size=420x420&format=Png&isCircular=false`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (respAvatar.ok) {
      const miniatura = await respAvatar.json();
      avatar = miniatura.data?.[0]?.imageUrl ?? null;
    }

    return { id: usuario.id, nome: usuario.name, avatar };
  } catch (erro) {
    if (erro instanceof RobloxErro) throw erro;
    throw new RobloxErro(erro.message);
  }
}

// ============================================================================
// Interface: respostas, embeds e componentes
// ============================================================================
const iconeDoServidor = (guild) => guild.iconURL() ?? undefined;
const mencionar = (item) => (item ? `${item}` : '`Não configurado`');

/** Responde (ou edita a resposta) com um aviso discreto e padronizado. */
function aviso(interaction, descricao, cor = COR.ERRO) {
  const embeds = [new EmbedBuilder().setColor(cor).setDescription(descricao)];
  if (interaction.deferred || interaction.replied) return interaction.editReply({ embeds });
  return interaction.reply({ embeds, flags: EFEMERO });
}

const sucesso = (interaction, descricao) => aviso(interaction, descricao, COR.SUCESSO);

/** Formata o texto como citação (barra lateral), respeitando o limite do embed. */
function citar(texto, limite = 1024) {
  if (!texto.trim()) return '> -';
  const citado = texto
    .trim()
    .split(/\r?\n/)
    .map((linha) => (linha.trim() ? `> ${linha}` : '>'))
    .join('\n');
  return citado.length > limite ? `${citado.slice(0, limite - 1)}…` : citado;
}

/** Lista dos times registrados, no formato "emoji @cargo — jogadores/capacidade". */
function listaDeTimes(g) {
  const times = Object.values(g.teams);
  if (!times.length) return '`Nenhum time registrado`';

  const linhas = [];
  let tamanho = 0;
  for (const [i, time] of times.entries()) {
    const linha = `${fmtTime(time)} — \`${time.jogadores.length}/${g.roster_cap}\``;
    if (tamanho + linha.length > 950) {
      linhas.push(`… e mais ${times.length - i}`);
      break;
    }
    linhas.push(linha);
    tamanho += linha.length + 1;
  }
  return linhas.join('\n');
}

function embedPainel(guild) {
  const g = carregarGuild(guild.id);
  const canalFa = g.free_agency_channel && guild.channels.cache.get(g.free_agency_channel);
  const canalContratos = g.contracts_channel && guild.channels.cache.get(g.contracts_channel);

  return new EmbedBuilder()
    .setColor(COR.PRIMARIA)
    .setAuthor({ name: guild.name, iconURL: iconeDoServidor(guild) })
    .setTitle('Painel de Controle')
    .setDescription('Gerencie as configurações do sistema. Selecione um módulo nos botões abaixo.')
    .addFields(
      { name: 'Free Agency', value: `Canal: ${mencionar(canalFa)}`, inline: true },
      {
        name: 'Contratos',
        value: `Canal: ${mencionar(canalContratos)}\nCapacidade: \`${g.roster_cap}\``,
        inline: true,
      },
      { name: 'Times registrados', value: `\`${Object.keys(g.teams).length}\``, inline: true },
    )
    .setFooter({ text: 'Acesso restrito à administração' });
}

function embedContratos(guild) {
  const g = carregarGuild(guild.id);
  const canal = g.contracts_channel && guild.channels.cache.get(g.contracts_channel);
  const manager = g.manager_role && guild.roles.cache.get(g.manager_role);
  const assistente = g.assistant_role && guild.roles.cache.get(g.assistant_role);

  return new EmbedBuilder()
    .setColor(COR.PRIMARIA)
    .setAuthor({ name: guild.name, iconURL: iconeDoServidor(guild) })
    .setTitle('Painel de Contratos')
    .setDescription('Defina a capacidade dos times, o canal de registro e os cargos responsáveis.')
    .addFields(
      { name: 'Capacidade por time', value: `\`${g.roster_cap}\``, inline: true },
      { name: 'Canal de contratos', value: mencionar(canal), inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Cargo de manager', value: mencionar(manager), inline: true },
      { name: 'Cargo de assistente', value: mencionar(assistente), inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Times registrados', value: listaDeTimes(g), inline: false },
    )
    .setFooter({ text: 'Os times são cadastrados com o comando /addteam' });
}

const botao = (id, rotulo, estilo) => new ButtonBuilder().setCustomId(id).setLabel(rotulo).setStyle(estilo);
const linha = (...itens) => new ActionRowBuilder().addComponents(...itens);

const telaPainel = () => [
  linha(
    botao('painel:freeagency', 'Free Agency', ButtonStyle.Primary),
    botao('painel:contratos', 'Contratos', ButtonStyle.Secondary),
  ),
];

const telaContratos = () => [
  linha(
    botao('contratos:capacidade', 'Capacidade', ButtonStyle.Primary),
    botao('contratos:canal', 'Canal de contratos', ButtonStyle.Primary),
    botao('contratos:manager', 'Cargo de manager', ButtonStyle.Secondary),
    botao('contratos:assistente', 'Cargo de assistente', ButtonStyle.Secondary),
    botao('voltar:painel', 'Voltar', ButtonStyle.Danger),
  ),
];

/** Menu de seleção de canal. `destino` indica a tela para onde voltar. */
const telaEscolherCanal = (chave, placeholder, destino) => [
  linha(
    new ChannelSelectMenuBuilder()
      .setCustomId(`sel:canal:${chave}:${destino}`)
      .setPlaceholder(placeholder)
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  ),
  linha(botao(`voltar:${destino}`, 'Voltar', ButtonStyle.Secondary)),
];

const telaEscolherCargo = (chave, placeholder) => [
  linha(
    new RoleSelectMenuBuilder()
      .setCustomId(`sel:cargo:${chave}`)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1),
  ),
  linha(botao('voltar:contratos', 'Voltar', ButtonStyle.Secondary)),
];

/** Atualiza a mensagem do painel para a tela 'painel' ou 'contratos'. */
function irPara(interaction, destino) {
  if (destino === 'contratos') {
    return interaction.update({ embeds: [embedContratos(interaction.guild)], components: telaContratos() });
  }
  return interaction.update({ embeds: [embedPainel(interaction.guild)], components: telaPainel() });
}

function campoDeTexto(id, rotulo, placeholder, estilo, min, max) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(rotulo)
      .setPlaceholder(placeholder)
      .setStyle(estilo)
      .setMinLength(min)
      .setMaxLength(max)
      .setRequired(true),
  );
}

const modalFreeAgency = () =>
  new ModalBuilder()
    .setCustomId('modal:freeagency')
    .setTitle('Free Agency')
    .addComponents(
      campoDeTexto('nick', 'Nick do Roblox', 'Exemplo: ByGuustt', TextInputStyle.Short, 3, 20),
      campoDeTexto('posicao', 'Posição', 'Exemplo: CDM, ST, CM, CB', TextInputStyle.Short, 1, 50),
      campoDeTexto('experiencias', 'Experiências', 'Exemplo: PCS, TCSL', TextInputStyle.Paragraph, 1, 1000),
    );

const modalCapacidade = () =>
  new ModalBuilder()
    .setCustomId('modal:capacidade')
    .setTitle('Capacidade por time')
    .addComponents(
      campoDeTexto('quantidade', 'Número máximo de jogadores', 'Exemplo: 20', TextInputStyle.Short, 1, 3),
    );

// ============================================================================
// Free Agency
// ============================================================================
async function enviarFreeAgency(interaction) {
  await interaction.deferReply({ flags: EFEMERO });

  const g = carregarGuild(interaction.guildId);
  const canal = g.free_agency_channel && interaction.guild.channels.cache.get(g.free_agency_channel);
  if (!canal) return aviso(interaction, MSG.FA_SEM_CANAL);

  const nick = interaction.fields.getTextInputValue('nick').trim();
  const posicao = interaction.fields.getTextInputValue('posicao').trim();
  const experiencias = interaction.fields.getTextInputValue('experiencias');

  let roblox;
  try {
    roblox = await buscarRoblox(nick);
  } catch {
    return aviso(interaction, MSG.ROBLOX_INDISPONIVEL);
  }
  if (roblox === null) return aviso(interaction, MSG.ROBLOX_NAO_ENCONTRADO);

  const embed = new EmbedBuilder()
    .setColor(COR.PRIMARIA)
    .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL() })
    .setTitle('Free Agency')
    .addFields(
      {
        name: 'Jogador',
        value: `[${roblox.nome}](https://www.roblox.com/users/${roblox.id}/profile)`,
        inline: true,
      },
      { name: 'Posição', value: posicao, inline: true },
      { name: 'Discord', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Experiências', value: citar(experiencias), inline: false },
    )
    .setFooter({ text: `ID Roblox: ${roblox.id}` })
    .setTimestamp();
  if (roblox.avatar) embed.setThumbnail(roblox.avatar);

  try {
    // A mensagem apenas menciona quem enviou; as informações ficam no embed.
    await canal.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
  } catch (erro) {
    if (erro.code === 50013 || erro.code === 50001) {
      return aviso(interaction, MSG.FA_SEM_PERMISSAO_CANAL(canal));
    }
    throw erro;
  }

  return sucesso(interaction, MSG.FA_ENVIADA(canal));
}

// ============================================================================
// Painel: botões, menus e formulários
// ============================================================================
async function tratarBotaoPainel(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return aviso(interaction, MSG.SEM_PERMISSAO);
  }

  switch (interaction.customId) {
    case 'painel:freeagency':
      return interaction.update({
        components: telaEscolherCanal('free_agency_channel', 'Selecione o canal de Free Agency', 'painel'),
      });
    case 'painel:contratos':
      return irPara(interaction, 'contratos');
    case 'contratos:capacidade':
      return interaction.showModal(modalCapacidade());
    case 'contratos:canal':
      return interaction.update({
        components: telaEscolherCanal('contracts_channel', 'Selecione o canal de contratos', 'contratos'),
      });
    case 'contratos:manager':
      return interaction.update({
        components: telaEscolherCargo('manager_role', 'Selecione o cargo de manager'),
      });
    case 'contratos:assistente':
      return interaction.update({
        components: telaEscolherCargo('assistant_role', 'Selecione o cargo de assistente'),
      });
    case 'voltar:painel':
      return irPara(interaction, 'painel');
    case 'voltar:contratos':
      return irPara(interaction, 'contratos');
    default:
      return undefined;
  }
}

async function tratarMenuPainel(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return aviso(interaction, MSG.SEM_PERMISSAO);
  }

  const partes = interaction.customId.split(':');

  if (partes[1] === 'canal') {
    const [, , chave, destino] = partes;
    const canal = interaction.channels.first();
    if (!canal) return aviso(interaction, MSG.CANAL_INVALIDO);

    const eu = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const permissoes = canal.permissionsFor(eu);
    const necessarias = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!permissoes?.has(necessarias)) return aviso(interaction, MSG.CANAL_SEM_PERMISSAO(canal));

    atualizarGuild(interaction.guildId, { [chave]: canal.id });
    return irPara(interaction, destino);
  }

  if (partes[1] === 'cargo') {
    const cargo = interaction.roles.first();
    if (!cargo) return undefined;
    if (cargo.id === interaction.guildId) return aviso(interaction, MSG.CARGO_INVALIDO);

    atualizarGuild(interaction.guildId, { [partes[2]]: cargo.id });
    return irPara(interaction, 'contratos');
  }

  return undefined;
}

async function tratarFormulario(interaction) {
  if (interaction.customId === 'modal:freeagency') return enviarFreeAgency(interaction);

  if (interaction.customId === 'modal:capacidade') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return aviso(interaction, MSG.SEM_PERMISSAO);
    }
    const valor = interaction.fields.getTextInputValue('quantidade').trim();
    const numero = Number(valor);
    if (!/^\d+$/.test(valor) || numero < 1 || numero > CAPACIDADE_MAXIMA) {
      return aviso(interaction, MSG.CAPACIDADE_INVALIDA);
    }

    atualizarGuild(interaction.guildId, { roster_cap: numero });
    return interaction.isFromMessage() ? irPara(interaction, 'contratos') : sucesso(interaction, `Capacidade definida: \`${numero}\``);
  }

  return undefined;
}

// ============================================================================
// Contratos: botões de aceitar e recusar (enviados no privado do jogador)
// custom_id: contrato:<aceitar|recusar>:<servidor>:<cargo do time>:<jogador>:<remetente>
// ============================================================================
async function tratarContrato(interaction) {
  const [, acao, guildId, cargoId, playerId, remetenteId] = interaction.customId.split(':');

  if (interaction.user.id !== playerId) return aviso(interaction, MSG.CONTRATO_ALHEIO);

  const guild = client.guilds.cache.get(guildId);

  if (acao === 'recusar') {
    const embed = new EmbedBuilder()
      .setColor(COR.ERRO)
      .setTitle('Proposta recusada')
      .setDescription('Você recusou esta proposta de contrato.');
    await interaction.update({ embeds: [embed], components: [] });

    const time = carregarGuild(guildId).teams[cargoId];
    const alvo = time ? fmtTimeTexto(time, guild) : 'seu time';
    return enviarPrivado(
      remetenteId,
      `**${interaction.user.displayName}** (\`${interaction.user.username}\`) recusou a proposta de contrato do ${alvo}.`,
    );
  }

  const [status, info] = aceitarContrato(guildId, cargoId, playerId);

  if (status === 'ja_aceito') return aviso(interaction, MSG.CONTRATO_JA_ACEITO);

  if (status !== 'ok') {
    const motivos = {
      sem_time: 'Este time não existe mais.',
      ja_em_time: 'Você já pertence a outro time.',
      cheio: 'Este time atingiu a capacidade máxima.',
    };
    const embed = new EmbedBuilder()
      .setColor(COR.ERRO)
      .setTitle('Não foi possível aceitar')
      .setDescription(motivos[status]);
    return interaction.update({ embeds: [embed], components: [] });
  }

  const { time } = info;
  const embedPrivado = new EmbedBuilder()
    .setColor(COR.SUCESSO)
    .setTitle('Proposta aceita')
    .setDescription(`Você agora faz parte do ${fmtTimeTexto(time, guild)}.`);
  await interaction.update({ embeds: [embedPrivado], components: [] });

  if (!guild) return undefined;

  const jogador = interaction.user;
  const pendencias = [];

  // Atribui o cargo do time ao jogador.
  const cargo = guild.roles.cache.get(cargoId);
  if (cargo) {
    try {
      const membro = await guild.members.fetch(playerId);
      await membro.roles.add(cargo, 'Contrato aceito');
    } catch {
      pendencias.push(
        `Não foi possível atribuir o cargo ${fmtTimeTexto(time, guild)} a **${jogador.displayName}**. ` +
          'Verifique se o meu cargo está acima do cargo do time e se possuo a permissão **Gerenciar Cargos**.',
      );
    }
  } else {
    pendencias.push('O cargo deste time não existe mais no servidor.');
  }

  // Anúncio no canal de contratos.
  const canal = info.canal ? guild.channels.cache.get(info.canal) : null;
  if (!canal) {
    pendencias.push(
      `**${jogador.displayName}** aceitou a proposta do ${fmtTimeTexto(time, guild)}, ` +
        'mas o canal de contratos não está configurado.',
    );
  } else {
    let usuarioRemetente = null;
    try {
      usuarioRemetente = (await client.users.fetch(remetenteId)).username;
    } catch {
      /* sem o nome de usuário do remetente */
    }

    const apelido = jogador.displayName !== jogador.username ? ` (${jogador.displayName})` : '';
    const descricao =
      `<@${jogador.id}>${apelido} \`${jogador.username}\` aceitou a oferta do ${fmtTime(time)}\n\n` +
      `• 🧢 **Coach** — <@${remetenteId}>${usuarioRemetente ? ` \`${usuarioRemetente}\`` : ''}\n` +
      `• 🔋 **Capacidade** — \`${info.total}/${info.cap}\``;

    const embed = new EmbedBuilder()
      .setColor(COR.ERRO)
      .setAuthor({ name: guild.name, iconURL: iconeDoServidor(guild) })
      .setTitle('Oferta aceita')
      .setDescription(descricao);

    try {
      await canal.send({ embeds: [embed] });
    } catch {
      pendencias.push(
        `**${jogador.displayName}** aceitou a proposta do ${fmtTimeTexto(time, guild)}, ` +
          `mas não foi possível enviar a mensagem em ${canal}.`,
      );
    }
  }

  if (pendencias.length) await enviarPrivado(remetenteId, pendencias.join('\n'));
  return undefined;
}

// ============================================================================
// Comandos
// ============================================================================
const comandos = [
  new SlashCommandBuilder()
    .setName('free-agency')
    .setDescription('Abre o formulário de Free Agency')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel de configurações')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('addteam')
    .setDescription('Registra um time (cargo e emoji)')
    .addRoleOption((o) => o.setName('cargo').setDescription('Cargo do time').setRequired(true))
    .addStringOption((o) => o.setName('emoji').setDescription('Emoji do time').setRequired(true))
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('removeteam')
    .setDescription('Remove um time registrado')
    .addRoleOption((o) => o.setName('cargo').setDescription('Cargo do time (padrão: o seu time)'))
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('contract')
    .setDescription('Envia uma proposta de contrato a um jogador')
    .addUserOption((o) => o.setName('jogador').setDescription('Jogador que receberá a proposta').setRequired(true))
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('release')
    .setDescription('Remove um jogador do seu time')
    .addUserOption((o) => o.setName('jogador').setDescription('Jogador que será removido').setRequired(true))
    .setDMPermission(false),
];

async function cmdFreeAgency(interaction) {
  const g = carregarGuild(interaction.guildId);
  if (!g.free_agency_channel) return aviso(interaction, MSG.FA_SEM_CANAL);
  return interaction.showModal(modalFreeAgency());
}

async function cmdPainel(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return aviso(interaction, MSG.SEM_PERMISSAO);
  }
  return interaction.reply({
    embeds: [embedPainel(interaction.guild)],
    components: telaPainel(),
    flags: EFEMERO,
  });
}

async function cmdAddTeam(interaction) {
  const dados = carregar();
  const g = normalizar(dados, interaction.guildId);
  const adm = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
  const cargo = interaction.options.getRole('cargo', true);
  const emoji = interaction.options.getString('emoji', true).trim();

  if (!adm && g.manager_role == null) return aviso(interaction, MSG.MANAGER_NAO_CONFIGURADO);
  if (!adm && !(ehManager(interaction.member, g) && temCargo(interaction.member, cargo.id))) {
    return aviso(interaction, MSG.SO_REGISTRAR);
  }
  if (cargo.id === interaction.guildId || cargo.managed) return aviso(interaction, MSG.CARGO_TIME_INVALIDO);
  if ([g.manager_role, g.assistant_role].includes(cargo.id)) return aviso(interaction, MSG.CARGO_EH_STAFF);
  if (!emojiValido(emoji)) return aviso(interaction, MSG.EMOJI_INVALIDO);
  if (g.teams[cargo.id]) return aviso(interaction, MSG.TIME_JA_REGISTRADO);

  g.teams[cargo.id] = { cargo_id: cargo.id, nome: cargo.name, emoji, jogadores: [] };
  salvar(dados);

  return sucesso(interaction, `${emoji} <@&${cargo.id}>`);
}

async function cmdRemoveTeam(interaction) {
  const dados = carregar();
  const g = normalizar(dados, interaction.guildId);
  const adm = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
  const cargo = interaction.options.getRole('cargo');

  let chave;
  let time;
  if (!cargo) {
    const times = timesDoMembro(g, interaction.member);
    if (!times.length) return aviso(interaction, MSG.SEM_TIME);
    if (times.length > 1) return aviso(interaction, MSG.MAIS_DE_UM_TIME_REMOVER);
    [chave, time] = times[0];
  } else {
    chave = cargo.id;
    time = g.teams[chave];
    if (!time) return aviso(interaction, MSG.TIME_NAO_REGISTRADO);
  }

  if (!adm && !(ehManager(interaction.member, g) && temCargo(interaction.member, time.cargo_id))) {
    return aviso(interaction, MSG.SO_REMOVER);
  }

  delete g.teams[chave];
  salvar(dados);
  return sucesso(interaction, `Time removido: ${fmtTime(time)}`);
}

async function cmdContract(interaction) {
  const g = carregarGuild(interaction.guildId);

  if (g.manager_role == null && g.assistant_role == null) return aviso(interaction, MSG.CARGOS_NAO_CONFIGURADOS);
  if (!ehStaff(interaction.member, g)) return aviso(interaction, MSG.SO_STAFF);

  const times = timesDoMembro(g, interaction.member);
  if (!times.length) return aviso(interaction, MSG.SEM_TIME);
  if (times.length > 1) return aviso(interaction, MSG.MAIS_DE_UM_TIME);
  const [chave, time] = times[0];

  const jogador = interaction.options.getMember('jogador');
  if (!jogador) return aviso(interaction, MSG.JOGADOR_AUSENTE);
  if (jogador.user.bot || jogador.id === interaction.user.id) return aviso(interaction, MSG.JOGADOR_INVALIDO);

  const [, timeAtual] = timeDoJogador(g, jogador.id);
  if (timeAtual) return aviso(interaction, MSG.JOGADOR_JA_NO_TIME(jogador, fmtTime(timeAtual)));

  const total = time.jogadores.length;
  if (total >= g.roster_cap) return aviso(interaction, MSG.TIME_LOTADO(fmtTime(time), total, g.roster_cap));

  const embed = new EmbedBuilder()
    .setColor(COR.PRIMARIA)
    .setAuthor({ name: interaction.guild.name, iconURL: iconeDoServidor(interaction.guild) })
    .setTitle('Proposta de contrato')
    .setDescription(`Você recebeu uma proposta para integrar o ${fmtTimeTexto(time, interaction.guild)}.`)
    .addFields(
      { name: 'Enviada por', value: interaction.member.displayName, inline: true },
      { name: 'Capacidade', value: `\`${total}/${g.roster_cap}\``, inline: true },
    )
    .setTimestamp();

  const base = `${interaction.guildId}:${chave}:${jogador.id}:${interaction.user.id}`;
  const botoes = linha(
    botao(`contrato:aceitar:${base}`, 'Aceitar', ButtonStyle.Success),
    botao(`contrato:recusar:${base}`, 'Recusar', ButtonStyle.Danger),
  );

  await interaction.deferReply({ flags: EFEMERO });
  try {
    await jogador.send({ embeds: [embed], components: [botoes] });
  } catch {
    return aviso(interaction, MSG.DM_FECHADA(jogador));
  }

  return sucesso(interaction, MSG.CONTRATO_ENVIADO(jogador));
}

async function cmdRelease(interaction) {
  const dados = carregar();
  const g = normalizar(dados, interaction.guildId);

  if (!ehStaff(interaction.member, g)) return aviso(interaction, MSG.SO_STAFF);

  const times = timesDoMembro(g, interaction.member);
  if (!times.length) return aviso(interaction, MSG.SEM_TIME);
  if (times.length > 1) return aviso(interaction, MSG.MAIS_DE_UM_TIME);
  const [, time] = times[0];

  const jogador = interaction.options.getMember('jogador');
  if (!jogador) return aviso(interaction, MSG.JOGADOR_AUSENTE);
  if (ehStaff(jogador, g)) return aviso(interaction, MSG.RELEASE_STAFF);

  const noTime = time.jogadores.includes(jogador.id) || temCargo(jogador, time.cargo_id);
  if (!noTime) return aviso(interaction, MSG.JOGADOR_FORA_DO_TIME(jogador));

  time.jogadores = time.jogadores.filter((id) => id !== jogador.id);
  salvar(dados);

  await interaction.deferReply({ flags: EFEMERO });

  let observacao = '';
  const cargo = interaction.guild.roles.cache.get(time.cargo_id);
  if (cargo && jogador.roles.cache.has(cargo.id)) {
    try {
      await jogador.roles.remove(cargo, `Release por ${interaction.user.username}`);
    } catch {
      observacao = '\nNão foi possível remover o cargo do time. Remova-o manualmente.';
    }
  }

  return sucesso(
    interaction,
    `${jogador} removido de ${fmtTime(time)} — \`${time.jogadores.length}/${g.roster_cap}\`${observacao}`,
  );
}

const comandosPorNome = {
  'free-agency': cmdFreeAgency,
  painel: cmdPainel,
  addteam: cmdAddTeam,
  removeteam: cmdRemoveTeam,
  contract: cmdContract,
  release: cmdRelease,
};

// ============================================================================
// Eventos
// ============================================================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) return await comandosPorNome[interaction.commandName]?.(interaction);
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('contrato:')) return await tratarContrato(interaction);
      return await tratarBotaoPainel(interaction);
    }
    if (interaction.isAnySelectMenu()) return await tratarMenuPainel(interaction);
    if (interaction.isModalSubmit()) return await tratarFormulario(interaction);
  } catch (erro) {
    console.error('Erro na interação:', erro);
    try {
      const embeds = [new EmbedBuilder().setColor(COR.ERRO).setDescription(MSG.ERRO_GENERICO)];
      if (interaction.deferred || interaction.replied) await interaction.followUp({ embeds, flags: EFEMERO });
      else if (interaction.isRepliable()) await interaction.reply({ embeds, flags: EFEMERO });
    } catch {
      /* não foi possível avisar o usuário */
    }
  }
  return undefined;
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot conectado como ${c.user.tag} (ID: ${c.user.id})`);
  try {
    const registrados = await c.application.commands.set(comandos.map((comando) => comando.toJSON()));
    console.log(`Comandos sincronizados: ${registrados.size}`);
  } catch (erro) {
    console.error('Erro ao sincronizar os comandos:', erro);
  }
});

process.on('unhandledRejection', (erro) => console.error('Erro não tratado:', erro));

if (require.main === module) {
  if (!TOKEN) {
    console.error('Defina o token em TOKEN_DO_BOT no início do index.js');
    process.exit(1);
  }
  client.login(TOKEN);
}

// Exportado apenas para testes.
module.exports = {
  normalizar,
  carregar,
  salvar,
  carregarGuild,
  aceitarContrato,
  timesDoMembro,
  fmtTime,
  fmtTimeTexto,
  emojiValido,
  citar,
  listaDeTimes,
  comandos,
  telaPainel,
  telaContratos,
  telaEscolherCanal,
  telaEscolherCargo,
  modalFreeAgency,
  modalCapacidade,
};

