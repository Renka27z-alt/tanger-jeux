/**
 * Script utilitaire : vérifie que chaque image de quizzes.json est
 * accessible (URL valide ou fichier local existant).
 *
 * Utilisation : node check-quizzes.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const quizzes = require('./quizzes.json');

function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      res.resume(); // libère le flux
      resolve({ ok, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, status: err.message }));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ ok: false, status: 'timeout' });
    });
  });
}

async function main() {
  console.log(`Vérification de ${quizzes.length} quiz...\n`);
  let okCount = 0;
  const broken = [];

  for (const quiz of quizzes) {
    const img = quiz.image;
    let result;

    if (/^https?:\/\//.test(img)) {
      result = await checkUrl(img);
    } else {
      const absolutePath = path.isAbsolute(img) ? img : path.join(__dirname, img);
      result = { ok: fs.existsSync(absolutePath), status: fs.existsSync(absolutePath) ? 'OK' : 'fichier introuvable' };
    }

    if (result.ok) {
      okCount++;
      console.log(`✅ ${quiz.answer}`);
    } else {
      broken.push(quiz.answer);
      console.log(`❌ ${quiz.answer} -> ${result.status} (${img})`);
    }
  }

  console.log(`\n${okCount}/${quizzes.length} quiz OK.`);
  if (broken.length > 0) {
    console.log(`\nÀ corriger : ${broken.join(', ')}`);
  }
}

main();
