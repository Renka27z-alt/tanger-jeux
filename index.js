process.env.TZ = 'Europe/Paris';

const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { generateQuizImage, preloadAllImages } = require('./generateImage');
let quizzes = require('./quizzes.json');
const { addPoint, addPoints, removePoints, getUserStats, resetPoints } = require('./points');
const { buildLeaderboardEmbed } = require('./leaderboard');
const {
  BTN_DECO, BTN_NITRO,
  POINTS_DECO, POINTS_NITRO,
  ROLE_DECO_ID, ROLE_NITRO_ID,
  sendShopEmbed, createTicket, giveTempRole
} = require('./shop');

// ====== CONFIGURATION ======
const TOKEN = process.env.TOKEN;
const OWNER_IDS = ['1289174457973211148', '1127748076120055890'];
const QUIZ_CHANNEL_ID = '1519420268219596930';
const LEADERBOARD_CHANNEL_ID = '1521251618119483532';
const ANSWER_TIME_LIMIT = 60 * 1000;
// ============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

let currentQuiz = null;
let currentQuizMessage = null;
let usedIndexes = [];
let quizTimeout = null;
let scheduleTimeout = null;
let quizRunning = false;
let leaderboardMessage = null;
let quizStartTime = null;

function isOwner(userId) {
  return OWNER_IDS.includes(userId);
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function pickQuiz() {
  if (usedIndexes.length >= quizzes.length) usedIndexes = [];

  let index;
  do {
    index = Math.floor(Math.random() * quizzes.length);
  } while (usedIndexes.includes(index));

  usedIndexes.push(index);
  return quizzes[index];
}

function msUntilNextQuarter() {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();

  const nextQuarterMinute = Math.ceil((minutes + seconds / 60 + ms / 60000) / 15) * 15;
  const diffMinutes = nextQuarterMinute - minutes;
  const diffMs = diffMinutes * 60 * 1000 - seconds * 1000 - ms;

  return diffMs;
}

async function updateLeaderboardEmbed() {
  if (!LEADERBOARD_CHANNEL_ID || LEADERBOARD_CHANNEL_ID === 'ID_DU_SALON_LEADERBOARD') return;

  try {
    const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
    const embed = await buildLeaderboardEmbed(client);

    if (leaderboardMessage) {
      try {
        await leaderboardMessage.edit({ embeds: [embed] });
        return;
      } catch (e) {
        leaderboardMessage = null;
      }
    }

    leaderboardMessage = await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[LEADERBOARD] Erreur lors de la mise à jour de l\'embed :', err);
  }
}

async function sendQuiz() {
  try {
    const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);

    if (quizTimeout) {
      clearTimeout(quizTimeout);
      quizTimeout = null;
    }

    if (currentQuizMessage) {
      try {
        await currentQuizMessage.delete();
      } catch (e) {}
    }

    currentQuiz = pickQuiz();
    const buffer = await generateQuizImage(currentQuiz, ANSWER_TIME_LIMIT);
    const attachment = new AttachmentBuilder(buffer, { name: 'quiz.png' });

    currentQuizMessage = await channel.send({ files: [attachment] });
    quizStartTime = Date.now();
    console.log(`[QUIZ] Nouveau quiz envoyé à ${new Date().toLocaleTimeString()}. Réponse : ${currentQuiz.answer}`);

    quizTimeout = setTimeout(() => revealAnswer(channel), ANSWER_TIME_LIMIT);
  } catch (err) {
    console.error('[QUIZ] Erreur lors de l\'envoi du quiz :', err);
  }
}

async function revealAnswer(channel) {
  if (!currentQuiz) return;

  const answer = currentQuiz.answer;

  if (currentQuizMessage) {
    try {
      await currentQuizMessage.delete();
    } catch (e) {}
    currentQuizMessage = null;
  }

  try {
    await channel.send(`⏰ Temps écoulé ! La réponse était : **${answer}**`);
  } catch (e) {
    console.error('[QUIZ] Erreur lors de l\'envoi du message de fin de temps :', e);
  }

  currentQuiz = null;
  quizTimeout = null;
}

function scheduleNextQuiz() {
  if (!quizRunning) return;

  const delay = msUntilNextQuarter();
  const nextTime = new Date(Date.now() + delay);
  console.log(`[QUIZ] Prochain quiz planifié à ${nextTime.toLocaleTimeString()} (dans ${Math.round(delay / 1000)}s)`);

  scheduleTimeout = setTimeout(async () => {
    await sendQuiz();
    scheduleNextQuiz();
  }, delay);
}

client.once('clientReady', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  if (LEADERBOARD_CHANNEL_ID && LEADERBOARD_CHANNEL_ID !== 'ID_DU_SALON_LEADERBOARD') {
    try {
      const lbChannel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
      let fetched;
      do {
        fetched = await lbChannel.messages.fetch({ limit: 100 });
        if (fetched.size === 0) break;
        await lbChannel.bulkDelete(fetched, true);
      } while (fetched.size >= 2);
      console.log(`[LEADERBOARD] Salon nettoyé au démarrage.`);
    } catch (e) {
      console.error('[LEADERBOARD] Erreur lors du nettoyage :', e);
    }
  }

  quizzes = await preloadAllImages(quizzes);
  if (quizzes.length === 0) {
    console.error('[PRELOAD] Aucune image disponible, le bot ne peut pas démarrer.');
    return;
  }
  startQuizLoop();
});

function startQuizLoop() {
  if (quizRunning) return;
  quizRunning = true;
  sendQuiz();
  scheduleNextQuiz();
}

async function stopQuizLoop() {
  quizRunning = false;

  if (scheduleTimeout) {
    clearTimeout(scheduleTimeout);
    scheduleTimeout = null;
  }

  if (quizTimeout) {
    clearTimeout(quizTimeout);
    quizTimeout = null;
  }

  if (currentQuizMessage) {
    try {
      await currentQuizMessage.delete();
    } catch (e) {}
    currentQuizMessage = null;
  }

  currentQuiz = null;
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();

  if (content === '-top') {
    const embed = await buildLeaderboardEmbed(client);
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (content === '-pointuser' || content.startsWith('-pointuser ')) {
    const targetUser = message.mentions.users.first() || message.author;
    const stats = getUserStats(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats de ${targetUser.username}`)
      .setColor('#3498db')
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Points', value: `${stats.points}`, inline: true },
        {
          name: 'Position',
          value: stats.rank ? `#${stats.rank} / ${stats.total}` : 'Non classé',
          inline: true
        }
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (content === '-help') {
    const embed = new EmbedBuilder()
      .setTitle('📖 Liste des commandes')
      .setColor('#9b59b6')
      .addFields(
        { name: '-top', value: 'Affiche le classement (TOP 5) des joueurs.' },
        { name: '-pointuser', value: 'Affiche tes propres points et ta position.' },
        { name: '-pointuser @membre', value: 'Affiche les points et la position d\'un autre membre.' },
        { name: '-boutique', value: 'Poste l\'embed boutique (owner).' },
        { name: '-quizz start', value: 'Lance un quiz immédiatement (owner).' },
        { name: '-quizz end', value: 'Arrête le quiz en cours (owner).' },
        { name: '-addpoint @membre [montant]', value: 'Ajoute X points à un membre (owner).' },
        { name: '-removepoint @membre [montant]', value: 'Retire X points à un membre (owner).' },
        { name: '-resetpoint @membre', value: 'Remet les points d\'un membre à 0 (owner).' },
        { name: '-close', value: 'Ferme et supprime un ticket (owner).' },
        { name: '-help', value: 'Affiche ce message.' }
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (content.startsWith('-addpoint')) {
    if (!isOwner(message.author.id)) {
      return message.reply('❌ Seul le owner peut utiliser cette commande.');
    }
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('❌ Utilisation : `-addpoint @membre [montant]`');
    const parts = message.content.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Précise un montant valide. Ex: `-addpoint @membre 5`');
    const newTotal = addPoints(targetUser.id, targetUser.username, amount);
    await updateLeaderboardEmbed();
    await message.channel.send(`✅ **+${amount} points** ajoutés à **${targetUser.username}**. Total : **${newTotal} pts**`);
    return;
  }

  if (content.startsWith('-removepoint')) {
    if (!isOwner(message.author.id)) {
      return message.reply('❌ Seul le owner peut utiliser cette commande.');
    }
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('❌ Utilisation : `-removepoint @membre [montant]`');
    const parts = message.content.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Précise un montant valide. Ex: `-removepoint @membre 5`');
    const newTotal = removePoints(targetUser.id, targetUser.username, amount);
    await updateLeaderboardEmbed();
    await message.channel.send(`✅ **-${amount} points** retirés à **${targetUser.username}**. Total : **${newTotal} pts**`);
    return;
  }

  if (content.startsWith('-resetpoint')) {
    if (!isOwner(message.author.id)) {
      return message.reply('❌ Seul le owner peut utiliser cette commande.');
    }
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('❌ Utilisation : `-resetpoint @membre`');
    const existed = resetPoints(targetUser.id);
    if (!existed) return message.reply(`❌ ${targetUser.username} n'a aucun point enregistré.`);
    await updateLeaderboardEmbed();
    await message.channel.send(`✅ Les points de **${targetUser.username}** ont été remis à 0.`);
    return;
  }

  if (content === '-boutique') {
    if (!isOwner(message.author.id)) {
      return message.reply('❌ Seul le owner peut utiliser cette commande.');
    }
    await sendShopEmbed(message.channel);
    return;
  }

  if (content === '-close') {
    if (!isOwner(message.author.id)) {
      return message.reply('❌ Seul le owner peut fermer un ticket.');
    }
    const channel = message.channel;
    if (!channel.name.startsWith('ticket-')) {
      return message.reply('❌ Cette commande ne peut être utilisée que dans un ticket.');
    }
    await channel.send('🔒 Ticket fermé. Ce salon sera supprimé dans **5 secondes**...');
    setTimeout(async () => {
      try {
        await channel.delete('Ticket fermé via -close');
      } catch (e) {
        console.error('[CLOSE] Erreur lors de la suppression du ticket :', e);
      }
    }, 5000);
    return;
  }

  if (message.channel.id === QUIZ_CHANNEL_ID) {
    if (content === '-quizz start') {
      if (!isOwner(message.author.id)) {
        return message.reply('❌ Seul le owner peut lancer un quiz.');
      }
      if (!quizRunning) {
        startQuizLoop();
      } else {
        await sendQuiz();
      }
      return;
    }

    if (content === '-quizz end') {
      if (!isOwner(message.author.id)) {
        return message.reply('❌ Seul le owner peut arrêter le quiz.');
      }
      await stopQuizLoop();
      await message.channel.send('🛑 Le quiz a été arrêté.');
      return;
    }
  }

  if (message.channel.id !== QUIZ_CHANNEL_ID) return;
  if (!currentQuiz) return;

  const userAnswer = normalize(message.content);
  const correctAnswer = normalize(currentQuiz.answer);

  if (userAnswer === correctAnswer) {
    const wonQuiz = currentQuiz;
    currentQuiz = null;
    const elapsed = quizStartTime ? ((Date.now() - quizStartTime) / 1000).toFixed(2) : null;
    quizStartTime = null;

    if (quizTimeout) {
      clearTimeout(quizTimeout);
      quizTimeout = null;
    }

    if (currentQuizMessage) {
      try {
        await currentQuizMessage.delete();
      } catch (e) {}
      currentQuizMessage = null;
    }

    const newTotal = addPoint(message.author.id, message.author.username);
    await updateLeaderboardEmbed();

    const timeStr = elapsed !== null ? ` en **${elapsed}s**` : '';
    const congratsMsg = await message.channel.send(
      `🎉 Bravo ${message.author} d'avoir trouvé la bonne réponse${timeStr} !\nLa réponse était : **${wonQuiz.answer}** (+1 point, total : ${newTotal})`
    );
    setTimeout(() => congratsMsg.delete().catch(() => {}), 8000);
  }
});

client.login(TOKEN);

// ====== GESTIONNAIRE DES BOUTONS (BOUTIQUE) ======
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (![BTN_DECO, BTN_NITRO].includes(interaction.customId)) return;

  const isDeco = interaction.customId === BTN_DECO;
  const requiredPoints = isDeco ? POINTS_DECO : POINTS_NITRO;
  const roleId = isDeco ? ROLE_DECO_ID : ROLE_NITRO_ID;
  const rewardName = isDeco ? 'Décoration' : 'Nitro';

  const stats = getUserStats(interaction.user.id);
  if (stats.points < requiredPoints) {
    return interaction.reply({
      content: `❌ Tu n'as pas assez de points ! Il te faut **${requiredPoints} pts** et tu en as **${stats.points}**.`,
      ephemeral: true
    });
  }

  // On diffère la réponse pour avoir plus de temps (15 min au lieu de 3 sec)
  await interaction.deferReply({ ephemeral: true });

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);

    resetPoints(interaction.user.id);
    const remaining = stats.points - requiredPoints;
    for (let i = 0; i < remaining; i++) {
      addPoint(interaction.user.id, interaction.user.username);
    }

    const [ticket] = await Promise.all([
      createTicket(interaction.guild, member, rewardName, requiredPoints),
      giveTempRole(member, roleId),
      updateLeaderboardEmbed()
    ]);

    await interaction.editReply({
      content: `✅ Achat validé ! **${requiredPoints} pts** ont été déduits.\n🎫 Ton ticket a été créé : ${ticket}\n⏳ Ton rôle **${rewardName}** expire dans 5 minutes.`
    });
  } catch (err) {
    console.error('[SHOP] Erreur lors du traitement de l\'achat :', err);
    await interaction.editReply({
      content: '❌ Une erreur est survenue lors du traitement de ton achat. Contacte un admin.'
    });
  }
});
