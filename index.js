process.env.TZ = 'Europe/Paris';

const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { generateQuizImage, preloadAllImages } = require('./generateImage');
const { generateQuestionImage } = require('./generateImage');
const { generateMixImage } = require('./generateImage');
const { generateCalcImage } = require('./generateImage');
let quizzes = require('./quizzes.json');
const { QUESTIONS } = require('./questions');
const { MIX_WORDS } = require('./mixWords');
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
const OWNER_IDS = ['1289174457973211148', '320703657446211594']; // ← tes 2 IDs owner
const QUIZ_CHANNEL_ID = '1519420268219596930';
const LEADERBOARD_CHANNEL_ID = '1521251618119483532';
const ANSWER_TIME_LIMIT = 60 * 1000;
// ============================

// ====== MODE BOSS ======
const BOSS_TARGET_ID = '1277003171969106054';
const BOSS_TAUNT_MESSAGES = [
  "nah t'as cru c'était fini ? question boss pour toi",
  "bro elle trouve encore... non c'est mort réponds à ça d'abord",
  "trop forte la fille on peut pas laisser passer ça",
  "t'as trouvé ok mais c'est pas suffisant question spéciale",
  "le bot t'a repérée question difficile en route",
  "elle abuse vraiment faut que ça s'arrête question boss",
  "c'est cheaté là sérieux réponds à ça d'abord",
  "non non non pas si vite question spéciale activée",
];
const BOSS_QUESTIONS = [
  { question: "Quelle est la capitale de l'Australie ?", answer: "canberra", hint: "c'est pas Sydney ni Melbourne" },
  { question: "En quelle année la Tour Eiffel a-t-elle été construite ?", answer: "1889", hint: "fin du 19ème siècle" },
  { question: "Combien de pays composent l'Union Européenne ?", answer: "27", hint: "après le Brexit" },
  { question: "Quel pays a la plus grande superficie au monde ?", answer: "russie", hint: "c'est en Europe/Asie" },
  { question: "Quelle est la formule chimique du sel de table ?", answer: "nacl", hint: "sodium + chlore" },
  { question: "Qui a inventé le téléphone ?", answer: "bell", hint: "Alexander Graham..." },
  { question: "Quelle est la planète la plus proche du soleil ?", answer: "mercure", hint: "première planète du système solaire" },
];
let bossMode = { active: false, pendingQuiz: null, question: null, timeoutId: null };
// =======================

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

// ====== QUIZ QUESTIONS TEXTE ======
let currentQuestion = null;
let currentQuestionMessage = null;
let questionTimeout = null;
let usedQuestionIndexes = [];
// ==================================

// ====== MIX DE LETTRES ======
let currentMix = null;
let currentMixMessage = null;
let mixTimeout = null;
let usedMixIndexes = [];
// =============================

// ====== CALCUL MENTAL ======
let currentCalc = null;
let currentCalcMessage = null;
let calcTimeout = null;
// ============================

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

function pickQuestion() {
  if (usedQuestionIndexes.length >= QUESTIONS.length) usedQuestionIndexes = [];
  let index;
  do {
    index = Math.floor(Math.random() * QUESTIONS.length);
  } while (usedQuestionIndexes.includes(index));
  usedQuestionIndexes.push(index);
  return QUESTIONS[index];
}

function pickMixWord() {
  if (usedMixIndexes.length >= MIX_WORDS.length) usedMixIndexes = [];
  let index;
  do {
    index = Math.floor(Math.random() * MIX_WORDS.length);
  } while (usedMixIndexes.includes(index));
  usedMixIndexes.push(index);
  return MIX_WORDS[index];
}

function scrambleWord(word) {
  const letters = word.toUpperCase().split('');
  if (letters.length <= 1) return letters;

  let shuffled;
  let attempts = 0;
  do {
    shuffled = [...letters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts++;
  } while (shuffled.join('') === letters.join('') && attempts < 20);

  return shuffled;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCalcProblem() {
  const ops = ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  let a, b, answer;
  if (op === '+') {
    a = randInt(10, 90);
    b = randInt(10, 90);
    answer = a + b;
  } else if (op === '-') {
    a = randInt(20, 99);
    b = randInt(1, a);
    answer = a - b;
  } else {
    a = randInt(2, 12);
    b = randInt(2, 12);
    answer = a * b;
  }

  return { a, b, op, answer };
}

function msUntilNextQuarter() {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();
  const nextQuarterMinute = Math.ceil((minutes + seconds / 60 + ms / 60000) / 15) * 15;
  const diffMinutes = nextQuarterMinute - minutes;
  return diffMinutes * 60 * 1000 - seconds * 1000 - ms;
}

async function updateLeaderboardEmbed() {
  if (!LEADERBOARD_CHANNEL_ID || LEADERBOARD_CHANNEL_ID === 'ID_DU_SALON_LEADERBOARD') return;
  try {
    const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
    const embed = await buildLeaderboardEmbed(client);
    if (leaderboardMessage) {
      try { await leaderboardMessage.edit({ embeds: [embed] }); return; }
      catch (e) { leaderboardMessage = null; }
    }
    leaderboardMessage = await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[LEADERBOARD] Erreur :', err);
  }
}

async function sendQuiz() {
  try {
    const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (quizTimeout) { clearTimeout(quizTimeout); quizTimeout = null; }
    if (currentQuizMessage) { try { await currentQuizMessage.delete(); } catch (e) {} }

    currentQuiz = pickQuiz();
    const buffer = await generateQuizImage(currentQuiz, ANSWER_TIME_LIMIT);
    const attachment = new AttachmentBuilder(buffer, { name: 'quiz.png' });

    currentQuizMessage = await channel.send({ files: [attachment] });
    quizStartTime = Date.now();
    console.log(`[QUIZ] Envoyé à ${new Date().toLocaleTimeString()}. Réponse : ${currentQuiz.answer}`);
    quizTimeout = setTimeout(() => revealAnswer(channel), ANSWER_TIME_LIMIT);
  } catch (err) {
    console.error('[QUIZ] Erreur envoi :', err);
  }
}

async function revealAnswer(channel) {
  if (!currentQuiz) return;
  const answer = currentQuiz.answer;
  if (currentQuizMessage) {
    try { await currentQuizMessage.delete(); } catch (e) {}
    currentQuizMessage = null;
  }
  try {
    const revealMsg = await channel.send(`⏰ Temps écoulé ! La réponse était : **${answer}**`);
    setTimeout(() => revealMsg.delete().catch(() => {}), 10000);
  } catch (e) {}
  currentQuiz = null;
  quizTimeout = null;
}

async function sendQuestion() {
  try {
    const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (questionTimeout) { clearTimeout(questionTimeout); questionTimeout = null; }
    if (currentQuestionMessage) { try { await currentQuestionMessage.delete(); } catch (e) {} }

    currentQuestion = pickQuestion();

    // Génère une image avec la question écrite dessus sur le fond background
    let buffer;
    try {
      buffer = await generateQuestionImage(currentQuestion.question, ANSWER_TIME_LIMIT);
    } catch (e) {
      // Si generateQuestionImage n'existe pas encore, envoie en texte simple
      currentQuestionMessage = await channel.send(
        `❓ **QUESTION** *(60 secondes pour répondre)*\n\n**${currentQuestion.question}**`
      );
      questionTimeout = setTimeout(() => revealQuestion(channel), ANSWER_TIME_LIMIT);
      return;
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'question.png' });
    currentQuestionMessage = await channel.send({ files: [attachment] });
    console.log(`[QST] Question envoyée. Réponse : ${currentQuestion.answers[0]}`);
    questionTimeout = setTimeout(() => revealQuestion(channel), ANSWER_TIME_LIMIT);
  } catch (err) {
    console.error('[QST] Erreur envoi :', err);
  }
}

async function revealQuestion(channel) {
  if (!currentQuestion) return;
  const answer = currentQuestion.answers[0];
  if (currentQuestionMessage) {
    try { await currentQuestionMessage.delete(); } catch (e) {}
    currentQuestionMessage = null;
  }
  try {
    const revealMsg = await channel.send(`⏰ Temps écoulé ! La réponse était : **${answer}**`);
    setTimeout(() => revealMsg.delete().catch(() => {}), 10000);
  } catch (e) {}
  currentQuestion = null;
  questionTimeout = null;
}

async function sendMix() {
  try {
    const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (mixTimeout) { clearTimeout(mixTimeout); mixTimeout = null; }
    if (currentMixMessage) { try { await currentMixMessage.delete(); } catch (e) {} }

    const entry = pickMixWord();
    const scrambled = scrambleWord(entry.word);
    currentMix = { word: entry.word, scrambled };

    // Génère une image avec les lettres mélangées sur le fond background
    let buffer;
    try {
      buffer = await generateMixImage(scrambled, ANSWER_TIME_LIMIT);
    } catch (e) {
      // Si generateMixImage n'existe pas encore, envoie en texte simple
      currentMixMessage = await channel.send(
        `🔤 **MIX DE LETTRES** *(60 secondes pour répondre)*\n\n**${scrambled.join(' ')}**`
      );
      mixTimeout = setTimeout(() => revealMix(channel), ANSWER_TIME_LIMIT);
      return;
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'mix.png' });
    currentMixMessage = await channel.send({ files: [attachment] });
    console.log(`[MIX] Mot envoyé : ${entry.word} → ${scrambled.join('')}`);
    mixTimeout = setTimeout(() => revealMix(channel), ANSWER_TIME_LIMIT);
  } catch (err) {
    console.error('[MIX] Erreur envoi :', err);
  }
}

async function revealMix(channel) {
  if (!currentMix) return;
  const answer = currentMix.word;
  if (currentMixMessage) {
    try { await currentMixMessage.delete(); } catch (e) {}
    currentMixMessage = null;
  }
  try {
    const revealMsg = await channel.send(`⏰ Temps écoulé ! Le mot était : **${answer}**`);
    setTimeout(() => revealMsg.delete().catch(() => {}), 10000);
  } catch (e) {}
  currentMix = null;
  mixTimeout = null;
}

async function sendCalc() {
  try {
    const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (calcTimeout) { clearTimeout(calcTimeout); calcTimeout = null; }
    if (currentCalcMessage) { try { await currentCalcMessage.delete(); } catch (e) {} }

    const problem = generateCalcProblem();
    currentCalc = problem;

    // Génère une image avec le calcul écrit dessus sur le fond background
    let buffer;
    try {
      buffer = await generateCalcImage(problem.a, problem.b, problem.op, ANSWER_TIME_LIMIT);
    } catch (e) {
      // Si generateCalcImage n'existe pas encore, envoie en texte simple
      const opSymbol = problem.op === '+' ? '+' : problem.op === '-' ? '−' : '×';
      currentCalcMessage = await channel.send(
        `🧮 **CALCUL MENTAL** *(60 secondes pour répondre)*\n\n**${problem.a} ${opSymbol} ${problem.b}**`
      );
      calcTimeout = setTimeout(() => revealCalc(channel), ANSWER_TIME_LIMIT);
      return;
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'calc.png' });
    currentCalcMessage = await channel.send({ files: [attachment] });
    console.log(`[CALC] Calcul envoyé : ${problem.a} ${problem.op} ${problem.b} = ${problem.answer}`);
    calcTimeout = setTimeout(() => revealCalc(channel), ANSWER_TIME_LIMIT);
  } catch (err) {
    console.error('[CALC] Erreur envoi :', err);
  }
}

async function revealCalc(channel) {
  if (!currentCalc) return;
  const answer = currentCalc.answer;
  if (currentCalcMessage) {
    try { await currentCalcMessage.delete(); } catch (e) {}
    currentCalcMessage = null;
  }
  try {
    const revealMsg = await channel.send(`⏰ Temps écoulé ! Le résultat était : **${answer}**`);
    setTimeout(() => revealMsg.delete().catch(() => {}), 10000);
  } catch (e) {}
  currentCalc = null;
  calcTimeout = null;
}

function scheduleNextQuiz() {
  if (!quizRunning) return;
  const delay = msUntilNextQuarter();
  const nextTime = new Date(Date.now() + delay);
  console.log(`[QUIZ] Prochain quiz à ${nextTime.toLocaleTimeString()} (dans ${Math.round(delay / 1000)}s)`);
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
      console.log(`[LEADERBOARD] Salon nettoyé.`);
    } catch (e) { console.error('[LEADERBOARD] Erreur nettoyage :', e); }
  }

  quizzes = await preloadAllImages(quizzes);
  if (quizzes.length === 0) {
    console.error('[PRELOAD] Aucune image disponible.');
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
  if (scheduleTimeout) { clearTimeout(scheduleTimeout); scheduleTimeout = null; }
  if (quizTimeout) { clearTimeout(quizTimeout); quizTimeout = null; }
  if (currentQuizMessage) { try { await currentQuizMessage.delete(); } catch (e) {} currentQuizMessage = null; }
  currentQuiz = null;
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();

  // ── Commandes tout le monde ──────────────────────────────
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
        { name: 'Position', value: stats.rank ? `#${stats.rank} / ${stats.total}` : 'Non classé', inline: true }
      )
      .setTimestamp();
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (content === '-help') {
    const PUBLIC_COMMANDS = [
      { name: '-top', value: 'Affiche le classement.' },
      { name: '-pointuser', value: 'Affiche tes points.' },
      { name: '-pointuser @membre', value: 'Affiche les points d\'un membre.' },
      { name: '-help', value: 'Affiche ce message.' }
    ];

    const OWNER_COMMANDS = [
      { name: '-boutique', value: 'Poste la boutique.' },
      { name: '-quizz start', value: 'Lance un quiz image.' },
      { name: '-quizz end', value: 'Arrête le quiz.' },
      { name: '-qst start', value: 'Lance une question texte.' },
      { name: '-mix start', value: 'Lance un mix de lettres à retrouver.' },
      { name: '-calc start', value: 'Lance un calcul mental.' },
      { name: '-addpoint @membre [montant]', value: 'Ajoute des points.' },
      { name: '-removepoint @membre [montant]', value: 'Retire des points.' },
      { name: '-resetpoint @membre', value: 'Remet les points à 0.' },
      { name: '-close', value: 'Ferme un ticket.' }
    ];

    const embed = new EmbedBuilder()
      .setTitle('📖 Liste des commandes')
      .setColor('#9b59b6')
      .setTimestamp();

    if (isOwner(message.author.id)) {
      embed.addFields(
        { name: '🌍 Commandes publiques', value: '\u200b' },
        ...PUBLIC_COMMANDS,
        { name: '👑 Commandes owner', value: '\u200b' },
        ...OWNER_COMMANDS
      );
    } else {
      embed.addFields(...PUBLIC_COMMANDS);
    }

    await message.channel.send({ embeds: [embed] });
    return;
  }

  // ── Commandes owner uniquement ───────────────────────────
  if (content.startsWith('-addpoint')) {
    if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut utiliser cette commande.');
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('❌ Utilisation : `-addpoint @membre [montant]`');
    const parts = message.content.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Montant invalide.');
    const newTotal = addPoints(targetUser.id, targetUser.username, amount);
    await updateLeaderboardEmbed();
    await message.channel.send(`✅ **+${amount} points** ajoutés à **${targetUser.username}**. Total : **${newTotal} pts**`);
    return;
  }

  if (content.startsWith('-removepoint')) {
    if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut utiliser cette commande.');
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('❌ Utilisation : `-removepoint @membre [montant]`');
    const parts = message.content.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Montant invalide.');
    const newTotal = removePoints(targetUser.id, targetUser.username, amount);
    await updateLeaderboardEmbed();
    await message.channel.send(`✅ **-${amount} points** retirés à **${targetUser.username}**. Total : **${newTotal} pts**`);
    return;
  }

  if (content.startsWith('-resetpoint')) {
    if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut utiliser cette commande.');
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('❌ Utilisation : `-resetpoint @membre`');
    const existed = resetPoints(targetUser.id);
    if (!existed) return message.reply(`❌ ${targetUser.username} n'a aucun point.`);
    await updateLeaderboardEmbed();
    await message.channel.send(`✅ Les points de **${targetUser.username}** ont été remis à 0.`);
    return;
  }

  if (content === '-boutique') {
    if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut utiliser cette commande.');
    await sendShopEmbed(message.channel);
    return;
  }

  if (content === '-close') {
    if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut fermer un ticket.');
    const channel = message.channel;
    if (!channel.name.startsWith('ticket-')) return message.reply('❌ Uniquement dans un ticket.');
    await channel.send('🔒 Ticket fermé. Suppression dans **5 secondes**...');
    setTimeout(async () => { try { await channel.delete(); } catch (e) {} }, 5000);
    return;
  }

  // ── Commandes dans le salon quiz ─────────────────────────
  if (message.channel.id === QUIZ_CHANNEL_ID) {

    if (content === '-quizz start') {
      if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut lancer un quiz.');
      if (!quizRunning) { startQuizLoop(); } else { await sendQuiz(); }
      return;
    }

    if (content === '-quizz end') {
      if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut arrêter le quiz.');
      await stopQuizLoop();
      await message.channel.send('🛑 Le quiz a été arrêté.');
      return;
    }

    if (content === '-qst start') {
      if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut lancer une question.');
      if (currentQuestion) return message.reply('❌ Une question est déjà en cours.');
      await sendQuestion();
      return;
    }

    if (content === '-mix start') {
      if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut lancer un mix de lettres.');
      if (currentMix) return message.reply('❌ Un mix de lettres est déjà en cours.');
      await sendMix();
      return;
    }

    if (content === '-calc start') {
      if (!isOwner(message.author.id)) return message.reply('❌ Seul le owner peut lancer un calcul mental.');
      if (currentCalc) return message.reply('❌ Un calcul est déjà en cours.');
      await sendCalc();
      return;
    }

    // ── Mode BOSS : réponse de la joueuse ciblée ────────────
    if (bossMode.active && message.author.id === BOSS_TARGET_ID) {
      const userAnswer = normalize(message.content);
      const correctBossAnswer = normalize(bossMode.question.answer);

      if (userAnswer === correctBossAnswer) {
        if (bossMode.timeoutId) clearTimeout(bossMode.timeoutId);
        bossMode.active = false;
        const wonQuiz = bossMode.pendingQuiz;
        bossMode.pendingQuiz = null;
        bossMode.question = null;

        const newTotal = addPoint(message.author.id, message.author.username);
        await updateLeaderboardEmbed();
        if (currentQuizMessage) { try { await currentQuizMessage.delete(); } catch (e) {} currentQuizMessage = null; }

        const congratsMsg = await message.channel.send(
          `ok t'as réussi la question boss on va pas se mentir... **+1 point** (total : ${newTotal}) pour ${message.author} ! La réponse du quiz était **${wonQuiz.answer}**`
        );
        setTimeout(() => congratsMsg.delete().catch(() => {}), 10000);
      } else {
        if (bossMode.timeoutId) clearTimeout(bossMode.timeoutId);
        const savedAnswer = bossMode.question.answer;
        bossMode.active = false;
        bossMode.pendingQuiz = null;
        bossMode.question = null;

        const failMsg = await message.channel.send(
          `mauvaise réponse ${message.author} tu perds ton point la réponse était **${savedAnswer}**`
        );
        setTimeout(() => failMsg.delete().catch(() => {}), 10000);
      }
      return;
    }

    // ── Réponses aux questions texte ─────────────────────────
    if (currentQuestion && message.author.id !== BOSS_TARGET_ID || currentQuestion && !bossMode.active) {
      const userAnswer = normalize(message.content);
      const isCorrect = currentQuestion.answers.some(a => normalize(a) === userAnswer);

      if (isCorrect) {
        const wonQuestion = currentQuestion;
        currentQuestion = null;
        if (questionTimeout) { clearTimeout(questionTimeout); questionTimeout = null; }
        if (currentQuestionMessage) { try { await currentQuestionMessage.delete(); } catch (e) {} currentQuestionMessage = null; }

        const newTotal = addPoint(message.author.id, message.author.username);
        await updateLeaderboardEmbed();

        const congratsMsg = await message.channel.send(
          `🎉 Bravo ${message.author} bonne réponse !\nLa réponse était : **${wonQuestion.answers[0]}** (+1 point, total : ${newTotal})`
        );
        setTimeout(() => congratsMsg.delete().catch(() => {}), 8000);
        return;
      }
    }

    // ── Réponses au mix de lettres ────────────────────────────
    if (currentMix) {
      const userAnswer = normalize(message.content);
      const correctAnswer = normalize(currentMix.word);

      if (userAnswer === correctAnswer) {
        const wonWord = currentMix.word;
        currentMix = null;
        if (mixTimeout) { clearTimeout(mixTimeout); mixTimeout = null; }
        if (currentMixMessage) { try { await currentMixMessage.delete(); } catch (e) {} currentMixMessage = null; }

        const newTotal = addPoint(message.author.id, message.author.username);
        await updateLeaderboardEmbed();

        const congratsMsg = await message.channel.send(
          `🎉 Bravo ${message.author} tu as trouvé le mot !\nLe mot était : **${wonWord}** (+1 point, total : ${newTotal})`
        );
        setTimeout(() => congratsMsg.delete().catch(() => {}), 8000);
        return;
      }
    }

    // ── Réponses au calcul mental ─────────────────────────────
    if (currentCalc) {
      const userNumber = parseInt(message.content.trim(), 10);

      if (!isNaN(userNumber) && userNumber === currentCalc.answer) {
        const wonAnswer = currentCalc.answer;
        currentCalc = null;
        if (calcTimeout) { clearTimeout(calcTimeout); calcTimeout = null; }
        if (currentCalcMessage) { try { await currentCalcMessage.delete(); } catch (e) {} currentCalcMessage = null; }

        const newTotal = addPoint(message.author.id, message.author.username);
        await updateLeaderboardEmbed();

        const congratsMsg = await message.channel.send(
          `🎉 Bravo ${message.author} bon calcul !\nLe résultat était : **${wonAnswer}** (+1 point, total : ${newTotal})`
        );
        setTimeout(() => congratsMsg.delete().catch(() => {}), 8000);
        return;
      }
    }

    // ── Réponses aux quiz images ──────────────────────────────
    if (!currentQuiz) return;

    const userAnswer = normalize(message.content);
    const correctAnswer = normalize(currentQuiz.answer);

    if (userAnswer === correctAnswer) {

      // Mode BOSS si c'est la joueuse ciblée
      if (message.author.id === BOSS_TARGET_ID) {
        const wonQuiz = currentQuiz;
        currentQuiz = null;
        quizStartTime = null;
        if (quizTimeout) { clearTimeout(quizTimeout); quizTimeout = null; }

        const taunt = BOSS_TAUNT_MESSAGES[Math.floor(Math.random() * BOSS_TAUNT_MESSAGES.length)];
        const bossQ = BOSS_QUESTIONS[Math.floor(Math.random() * BOSS_QUESTIONS.length)];

        bossMode.active = true;
        bossMode.pendingQuiz = wonQuiz;
        bossMode.question = bossQ;

        await message.channel.send(
          `${taunt}\n\n${message.author} réponds en **30 secondes** !\n\n**${bossQ.question}**\n*(indice : ${bossQ.hint})*`
        );

        bossMode.timeoutId = setTimeout(async () => {
          if (!bossMode.active) return;
          bossMode.active = false;
          bossMode.pendingQuiz = null;
          bossMode.question = null;
          const timeoutMsg = await message.channel.send(`t'as pas répondu à temps ${message.author} tu perds ton point`);
          setTimeout(() => timeoutMsg.delete().catch(() => {}), 8000);
        }, 30000);
        return;
      }

      // Réponse normale
      const wonQuiz = currentQuiz;
      currentQuiz = null;
      const elapsed = quizStartTime ? ((Date.now() - quizStartTime) / 1000).toFixed(2) : null;
      quizStartTime = null;
      if (quizTimeout) { clearTimeout(quizTimeout); quizTimeout = null; }
      if (currentQuizMessage) { try { await currentQuizMessage.delete(); } catch (e) {} currentQuizMessage = null; }

      const newTotal = addPoint(message.author.id, message.author.username);
      await updateLeaderboardEmbed();

      const timeStr = elapsed !== null ? ` en **${elapsed}s**` : '';
      const congratsMsg = await message.channel.send(
        `🎉 Bravo ${message.author} d'avoir trouvé la bonne réponse${timeStr} !\nLa réponse était : **${wonQuiz.answer}** (+1 point, total : ${newTotal})`
      );
      setTimeout(() => congratsMsg.delete().catch(() => {}), 8000);
    }
  }
});

client.login(TOKEN);

// ====== BOUTIQUE ======
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

  await interaction.deferReply({ ephemeral: true });

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    resetPoints(interaction.user.id);
    const remaining = stats.points - requiredPoints;
    for (let i = 0; i < remaining; i++) { addPoint(interaction.user.id, interaction.user.username); }

    const [ticket] = await Promise.all([
      createTicket(interaction.guild, member, rewardName, requiredPoints),
      giveTempRole(member, roleId),
      updateLeaderboardEmbed()
    ]);

    await interaction.editReply({
      content: `✅ Achat validé ! **${requiredPoints} pts** déduits.\n🎫 Ton ticket : ${ticket}\n⏳ Ton rôle **${rewardName}** expire dans 2 heures.`
    });
  } catch (err) {
    console.error('[SHOP] Erreur :', err);
    await interaction.editReply({ content: '❌ Une erreur est survenue. Contacte un admin.' });
  }
});
