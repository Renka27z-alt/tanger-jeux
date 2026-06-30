const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require('discord.js');
const { getUserStats } = require('./points');

// ====== CONFIG BOUTIQUE ======
const ROLE_OWNER_ID      = '1518406883139125369';
const ROLE_NITRO_ID      = '1518415288868016250';
const ROLE_DECO_ID       = '1518415536134946989';
const TICKET_CATEGORY_ID = 'ID_CATEGORIE_TICKETS';  // ← remplace par l'ID de ta catégorie tickets
const POINTS_DECO        = 80;
const POINTS_NITRO       = 120;
const TEMPROLE_DURATION  = 240 * 60 * 1000; 
// ============================

// Boutique IDs des boutons (pour les identifier dans interactionCreate)
const BTN_DECO  = 'shop_deco';
const BTN_NITRO = 'shop_nitro';

/**
 * Construit et envoie l'embed boutique avec les deux boutons dans un salon.
 * @param {import('discord.js').TextChannel} channel
 */
async function sendShopEmbed(channel) {
  const embed = new EmbedBuilder()
    .setTitle('✨ BOUTIQUE OFFICIELLE & RÉCOMPENSES ✨')
    .setColor('#9b59b6')
    .setDescription(
      'Bienvenue dans la boutique ! Ici, vous pouvez échanger vos points durement gagnés contre des récompenses exclusives.\n\n' +
      '**📜 CONCEPT & RÈGLES :**\n' +
      '• Accumulez des points en répondant correctement aux quiz.\n' +
      '• Vérifiez votre solde avec `-pointuser` avant de cliquer.\n' +
      '• Tout achat est définitif. Aucun remboursement de points ne sera effectué.\n\n' +
      '**🎁 RÉCOMPENSES DISPONIBLES :**\n\n' +
      `1️⃣ **Décoration** *(Rôle temporaire 5 min)* ➔ Prix : **${POINTS_DECO} points**\n` +
      '   • Prouve ton statut + un ticket est ouvert pour réclamer ta récompense.\n\n' +
      `2️⃣ **Nitro** *(Rôle temporaire 5 min)* ➔ Prix : **${POINTS_NITRO} points**\n` +
      '   • Prouve ton statut + un ticket est ouvert pour réclamer ta récompense.'
    )
    .setFooter({ text: 'Utilisez -pointuser pour voir votre solde' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BTN_DECO)
      .setLabel(`🎨 Décoration — ${POINTS_DECO} pts`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BTN_NITRO)
      .setLabel(`💎 Nitro — ${POINTS_NITRO} pts`)
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

/**
 * Crée un salon ticket privé (visible uniquement par l'acheteur + Owner).
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {string} rewardName - "Décoration" ou "Nitro"
 * @param {number} pointsSpent
 */
async function createTicket(guild, member, rewardName, pointsSpent) {
  const categoryOptions = {};
  if (TICKET_CATEGORY_ID && TICKET_CATEGORY_ID !== 'ID_CATEGORIE_TICKETS') {
    categoryOptions.parent = TICKET_CATEGORY_ID;
  }

  const ticketChannel = await guild.channels.create({
    name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    type: ChannelType.GuildText,
    ...categoryOptions,
    permissionOverwrites: [
      {
        // @everyone ne voit pas le salon
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        // L'acheteur peut lire + écrire
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        // Le rôle Owner voit et gère le ticket
        id: ROLE_OWNER_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ]
  });

  // Message automatique dans le ticket
  const recapEmbed = new EmbedBuilder()
    .setTitle('🛒 Récapitulatif d\'achat')
    .setColor('#2ecc71')
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Membre', value: `${member} (${member.user.tag})`, inline: true },
      { name: 'ID', value: member.id, inline: true },
      { name: 'Récompense', value: rewardName, inline: true },
      { name: 'Points dépensés', value: `${pointsSpent} pts`, inline: true }
    )
    .setTimestamp();

  const ownerRole = guild.roles.cache.get(ROLE_OWNER_ID);
  const ownerMention = ownerRole ? `<@&${ROLE_OWNER_ID}>` : 'Owner';

  await ticketChannel.send({
    content: `${ownerMention} — Nouvelle réclamation de ${member} !`,
    embeds: [recapEmbed]
  });

  return ticketChannel;
}

/**
 * Donne un rôle temporaire à un membre pendant TEMPROLE_DURATION ms,
 * puis le retire automatiquement.
 * @param {import('discord.js').GuildMember} member
 * @param {string} roleId
 */
async function giveTempRole(member, roleId) {
  await member.roles.add(roleId);

  setTimeout(async () => {
    try {
      await member.roles.remove(roleId);
    } catch (e) {
      console.error(`[SHOP] Impossible de retirer le rôle temporaire ${roleId} :`, e.message);
    }
  }, TEMPROLE_DURATION);
}

module.exports = {
  BTN_DECO,
  BTN_NITRO,
  POINTS_DECO,
  POINTS_NITRO,
  ROLE_DECO_ID,
  ROLE_NITRO_ID,
  sendShopEmbed,
  createTicket,
  giveTempRole
};
