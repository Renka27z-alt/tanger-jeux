const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'points.json');

/**
 * Structure du fichier points.json :
 * {
 *   "userId1": { "points": 3, "username": "Pseudo1" },
 *   "userId2": { "points": 1, "username": "Pseudo2" }
 * }
 */

function loadData() {
  if (!fs.existsSync(DB_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[POINTS] Erreur lecture points.json :', e);
    return {};
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[POINTS] Erreur écriture points.json :', e);
  }
}

/**
 * Ajoute 1 point à l'utilisateur et met à jour son pseudo en cache.
 * @param {string} userId
 * @param {string} username
 * @returns {number} nouveau total de points de l'utilisateur
 */
function addPoint(userId, username) {
  const data = loadData();

  if (!data[userId]) {
    data[userId] = { points: 0, username };
  }

  data[userId].points += 1;
  data[userId].username = username; // garde le pseudo à jour

  saveData(data);
  return data[userId].points;
}

/**
 * Renvoie le classement complet trié par points décroissants.
 * @returns {Array<{userId: string, points: number, username: string}>}
 */
function getLeaderboard() {
  const data = loadData();

  return Object.entries(data)
    .map(([userId, info]) => ({
      userId,
      points: info.points,
      username: info.username
    }))
    .sort((a, b) => b.points - a.points);
}

/**
 * Renvoie les stats d'un utilisateur précis : points + position (rang) dans
 * le classement global. Position = null si l'utilisateur n'a aucun point.
 * @param {string} userId
 */
function getUserStats(userId) {
  const leaderboard = getLeaderboard();
  const index = leaderboard.findIndex((entry) => entry.userId === userId);

  if (index === -1) {
    return { points: 0, rank: null, total: leaderboard.length };
  }

  return {
    points: leaderboard[index].points,
    rank: index + 1,
    total: leaderboard.length
  };
}

/**
 * Remet à zéro les points d'un utilisateur (utilisé après réclamation
 * d'une récompense). Conserve l'entrée à 0 plutôt que de la supprimer,
 * pour garder le pseudo en cache.
 * @param {string} userId
 * @returns {boolean} true si l'utilisateur existait, false sinon
 */
function resetPoints(userId) {
  const data = loadData();

  if (!data[userId]) {
    return false;
  }

  data[userId].points = 0;
  saveData(data);
  return true;
}

/**
 * Ajoute un nombre précis de points à un utilisateur (commande admin).
 * @param {string} userId
 * @param {string} username
 * @param {number} amount
 * @returns {number} nouveau total
 */
function addPoints(userId, username, amount) {
  const data = loadData();
  if (!data[userId]) data[userId] = { points: 0, username };
  data[userId].points += amount;
  data[userId].username = username;
  saveData(data);
  return data[userId].points;
}

/**
 * Retire un nombre précis de points à un utilisateur (commande admin).
 * Le total ne peut pas descendre en dessous de 0.
 * @param {string} userId
 * @param {string} username
 * @param {number} amount
 * @returns {number} nouveau total
 */
function removePoints(userId, username, amount) {
  const data = loadData();
  if (!data[userId]) data[userId] = { points: 0, username };
  data[userId].points = Math.max(0, data[userId].points - amount);
  data[userId].username = username;
  saveData(data);
  return data[userId].points;
}

module.exports = {
  addPoint,
  addPoints,
  removePoints,
  getLeaderboard,
  getUserStats,
  resetPoints
};
