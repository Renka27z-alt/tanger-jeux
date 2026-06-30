const { EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('./points');

const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅'];

/**
 * Construit l'embed de classement (TOP 5).
 * @param {import('discord.js').Client} client - utilisé pour résoudre les avatars
 */
async function buildLeaderboardEmbed(client) {
  const leaderboard = getLeaderboard().slice(0, 5);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Classement du Quiz')
    .setColor('#f1c40f')
    .setTimestamp();

  if (leaderboard.length === 0) {
    embed.setDescription('Aucun point n\'a encore été marqué. Soyez le premier !');
    return embed;
  }

  const lines = [];
  let topAvatarURL = null;

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const medal = MEDALS[i] || `${i + 1}.`;
    const pointLabel = entry.points === 1 ? 'point' : 'points';

    lines.push(`${medal} **${entry.username}** — ${entry.points} ${pointLabel}`);

    // Récupère l'avatar du joueur classé en 1ère position pour la thumbnail
    if (i === 0) {
      try {
        const user = await client.users.fetch(entry.userId);
        topAvatarURL = user.displayAvatarURL({ size: 256 });
      } catch (e) {
        // utilisateur introuvable (a peut-être quitté le serveur), on ignore
      }
    }
  }

  embed.setDescription(lines.join('\n'));
  if (topAvatarURL) {
    embed.setThumbnail(topAvatarURL);
  }

  return embed;
}

module.exports = { buildLeaderboardEmbed };
