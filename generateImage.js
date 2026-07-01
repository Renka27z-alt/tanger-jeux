const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { drawBackground } = require('./background');

// Cache des images pré-chargées au démarrage : quiz.image → Buffer PNG
const imageCache = new Map();

// Code couleur par difficulté
const DIFFICULTY_COLORS = {
  facile: '#2ecc71',
  moyen: '#f39c12',
  difficile: '#e74c3c'
};

// Image de fond (mets ta photo de Tanger ici)
const BACKGROUND_PATH = path.join(__dirname, 'assets', 'background.png');

const WIDTH = 800;
const HEIGHT = 1000;

function downloadImage(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Trop de redirections'));
    }

    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'QuizBotDiscord/1.0 (contact: discord-bot)'
        }
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return resolve(downloadImage(res.headers.location, redirectCount + 1));
        }

        if (res.statusCode === 429) {
          res.resume();
          const err = new Error(`HTTP 429 (rate-limit) pour ${url}`);
          err.rateLimited = true;
          return reject(err);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout de téléchargement'));
    });
  });
}

async function withRateLimitRetry(fn, label, maxRetries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!e.rateLimited || attempt === maxRetries) break;
      const waitMs = 3000 * Math.pow(2, attempt);
      console.warn(`[IMG] Rate-limit pour "${label}", nouvel essai dans ${waitMs}ms...`);
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }
  throw lastErr;
}

function downloadImageWithRetry(url, maxRetries = 3) {
  return withRateLimitRetry(() => downloadImage(url), url, maxRetries);
}

async function loadImageFlexible(imagePath) {
  if (imageCache.has(imagePath)) {
    return loadImage(imageCache.get(imagePath));
  }

  if (/^https?:\/\//.test(imagePath)) {
    const buffer = await downloadImageWithRetry(imagePath);
    return loadImage(buffer);
  }

  const absolutePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(__dirname, imagePath);

  return loadImage(fs.readFileSync(absolutePath));
}

async function preloadAllImages(quizList) {
  console.log(`[PRELOAD] Chargement de ${quizList.length} images...`);

  const valid = [];

  for (let i = 0; i < quizList.length; i++) {
    const quiz = quizList[i];
    const img = quiz.image;

    try {
      let rawBuffer;

      if (/^https?:\/\//.test(img)) {
        rawBuffer = await downloadImageWithRetry(img);
      } else {
        const abs = path.isAbsolute(img) ? img : path.join(__dirname, img);
        rawBuffer = fs.readFileSync(abs);
      }

      imageCache.set(img, rawBuffer);
      valid.push(quiz);
      console.log(`[PRELOAD] ✅ "${quiz.answer}" (${valid.length}/${quizList.length})`);
    } catch (e) {
      console.warn(`[PRELOAD] ❌ "${quiz.answer}" — fichier introuvable : ${img}`);
    }
  }

  console.log(`[PRELOAD] Terminé : ${valid.length}/${quizList.length} images chargées.`);
  return valid;
}

async function generateQuizImage(quiz, timeLimitMs = 60000) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  try {
    const bgImg = await loadImageFlexible(BACKGROUND_PATH);
    drawImageCover(ctx, bgImg, 0, 0, WIDTH, HEIGHT, 0.5);
  } catch (e) {
    drawBackground(ctx, WIDTH, HEIGHT);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const margin = 30;
  const cardWidth = WIDTH - margin * 2;

  // ===== Carte titre =====
  const titleH = 110;
  drawCard(ctx, margin, margin, cardWidth, titleH);

  drawGamepadIcon(ctx, margin + 60, margin + titleH / 2, 28, '#ffffff');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('QUIZ CHALLENGE', margin + 115, margin + titleH / 2);

  // ===== Carte stats =====
  const statsY = margin + titleH + 20;
  const statsH = 170;
  drawCard(ctx, margin, statsY, cardWidth, statsH);

  const diffKey = (quiz.difficulty || '').toLowerCase();
  const diffColor = DIFFICULTY_COLORS[diffKey] || '#7f8c8d';
  const diffLabel = quiz.difficulty
    ? quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)
    : '—';

  const stats = [
    {
      icon: (cx, cy) => drawLightningIcon(ctx, cx, cy, 26, diffColor),
      label: 'DIFFICULTÉ',
      value: diffLabel
    },
    {
      icon: (cx, cy) => drawStarIcon(ctx, cx, cy, 26, '#f1c40f'),
      label: 'CATÉGORIE',
      value: (quiz.type || '—').toUpperCase()
    },
    {
      icon: (cx, cy) => drawCoinIcon(ctx, cx, cy, 26, '#3498db'),
      label: 'RÉCOMPENSE',
      value: quiz.reward || '—'
    },
    {
      icon: (cx, cy) => drawClockIcon(ctx, cx, cy, 26, '#e74c3c'),
      label: 'TEMPS',
      value: formatTime(timeLimitMs)
    }
  ];

  const cols = stats.length;
  const colWidth = cardWidth / cols;

  stats.forEach((stat, i) => {
    const cx = margin + colWidth * i + colWidth / 2;
    const iconCy = statsY + 55;
    stat.icon(cx, iconCy);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stat.label, cx, statsY + 105);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px Arial';
    ctx.fillText(stat.value, cx, statsY + 134);
  });

  // ===== Carte image (élément à deviner) =====
  const imageY = statsY + statsH + 20;
  const imageH = HEIGHT - imageY - margin;
  drawCard(ctx, margin, imageY, cardWidth, imageH);

  const charImg = await loadImageFlexible(quiz.image);
  const innerPad = 0;
  const innerX = margin + innerPad;
  const innerY = imageY + innerPad;
  const innerW = cardWidth - innerPad * 2;
  const innerH = imageH - innerPad * 2;

  ctx.save();
  roundRect(ctx, innerX, innerY, innerW, innerH, 16);
  ctx.clip();
  drawImageCover(ctx, charImg, innerX, innerY, innerW, innerH);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

function formatTime(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60000);
  return `${minutes} min`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCard(ctx, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = 'rgba(60, 30, 90, 0.55)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 150, 200, 0.6)';
  ctx.stroke();
  ctx.restore();
}

function drawGamepadIcon(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;

  roundRect(ctx, cx - size, cy - size * 0.5, size * 2, size, size * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx + size * 0.45, cy - size * 0.05, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + size * 0.75, cy + size * 0.2, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.75, cy);
  ctx.lineTo(cx - size * 0.45, cy);
  ctx.moveTo(cx - size * 0.6, cy - size * 0.15);
  ctx.lineTo(cx - size * 0.6, cy + size * 0.15);
  ctx.stroke();

  ctx.restore();
}

function drawLightningIcon(ctx, cx, cy, r, color) {
  drawIconBackground(ctx, cx, cy, r, color);

  const s = r * 0.85;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.05);
  ctx.lineTo(cx - s * 0.05, cy + s * 0.05);
  ctx.lineTo(cx - s * 0.1, cy + s);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.05);
  ctx.closePath();
  ctx.fill();
}

function drawStarIcon(ctx, cx, cy, r, color) {
  drawIconBackground(ctx, cx, cy, r, color);

  ctx.fillStyle = color;
  const spikes = 5;
  const outerR = r * 0.6;
  const innerR = outerR * 0.5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCoinIcon(ctx, cx, cy, r, color) {
  drawIconBackground(ctx, cx, cy, r, color);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(r * 0.7)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', cx, cy + 1);
}

function drawClockIcon(ctx, cx, cy, r, color) {
  drawIconBackground(ctx, cx, cy, r, color);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - r * 0.35);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.25, cy + r * 0.1);
  ctx.stroke();
}

function drawIconBackground(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, 0.2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawImageCover(ctx, img, dx, dy, dWidth, dHeight, focusY = 0.15) {
  const imgRatio = img.width / img.height;
  const targetRatio = dWidth / dHeight;

  let sx, sy, sWidth, sHeight;

  if (imgRatio > targetRatio) {
    sHeight = img.height;
    sWidth = sHeight * targetRatio;
    sx = (img.width - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = img.width;
    sHeight = sWidth / targetRatio;
    sx = 0;
    const maxSy = img.height - sHeight;
    sy = maxSy * focusY;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

module.exports = {
  generateQuizImage,
  preloadAllImages,
  downloadImageWithRetry
};
