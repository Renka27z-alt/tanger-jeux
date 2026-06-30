# Quiz Bot Discord 🇲🇦🎮

Bot Discord en JavaScript (discord.js v14) qui envoie automatiquement un quiz
sous forme d'image toutes les 15 minutes, et félicite le premier utilisateur
qui trouve la bonne réponse.

## 📁 Structure du projet

```
quiz-bot/
├── index.js          → logique du bot (planification, réponses, nettoyage)
├── generateImage.js   → génère l'image du quiz (bandeau + perso + fond)
├── background.js      → dessine le fond "Maroc" sobre (100% Canvas, pas d'image externe)
├── quizzes.json        → liste des quiz (réponse, image, difficulté, type, bonus)
├── assets/characters/ → tes images de personnages/célébrités à ajouter ici
└── package.json
```

## ⚙️ Installation

```bash
npm install
```

### ⚠️ Important : la librairie `canvas`

Le projet utilise `canvas`, qui nécessite des dépendances système
(`cairo`, `pango`, `jpeg`, etc.) pour se compiler.

**Sur un VPS classique (Ubuntu/Debian)** :
```bash
apt-get update
apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev build-essential
npm install
```

**Sur Pterodactyl** : si tu as des soucis de build (erreurs node-gyp), utilise
plutôt `@napi-rs/canvas` qui fournit des binaires précompilés (aucune
compilation requise) :

```bash
npm uninstall canvas
npm install @napi-rs/canvas
```

Puis remplace dans `generateImage.js` :
```js
const { createCanvas, loadImage } = require('canvas');
```
par :
```js
const { createCanvas, loadImage } = require('@napi-rs/canvas');
```

L'API étant quasi identique, le reste du code fonctionne sans autre
modification.

## 🔧 Configuration

Dans `index.js`, renseigne (en dur, comme d'habitude sur Pterodactyl) :

```js
const TOKEN = 'TON_TOKEN_ICI';
const QUIZ_CHANNEL_ID = 'ID_DU_SALON';
```

⚠️ N'oublie pas d'activer l'intent **MESSAGE CONTENT** sur le Discord Developer
Portal (onglet "Bot"), sinon le bot ne pourra pas lire les réponses.

## 🖼️ Ajouter des quiz

Place tes images (personnages, célébrités, etc.) dans `assets/characters/`,
puis ajoute une entrée dans `quizzes.json` :

```json
{
  "answer": "Nom de la réponse exacte",
  "image": "./assets/characters/exemple.png",
  "difficulty": "facile",   // "facile" (vert) | "moyen" (orange) | "difficile" (rouge)
  "type": "Anime",          // ou "Film", "Série", "Football", etc.
  "bonus": "🎯 Texte libre"  // info esthétique affichée dans la case bonus
}
```

`image` peut aussi être une **URL directe** vers une image (http/https),
`loadImage` la chargera automatiquement.

Pour vérifier en un coup d'œil quelles images sont présentes ou manquantes
dans `assets/characters/` :

```bash
node check-quizzes.js
```

## ▶️ Lancer le bot

```bash
node index.js
```

## 🧠 Fonctionnement

- Toutes les 15 minutes : un quiz aléatoire (non répété tant que tous les
  quiz n'ont pas été utilisés) est généré en image et envoyé dans le salon.
- Si l'ancien quiz n'a pas été trouvé, son message est supprimé avant
  l'envoi du nouveau (anti-spam).
- Le bot compare chaque message du salon (sans tenir compte des
  majuscules/accents/espaces) à la réponse attendue.
- Dès qu'un utilisateur trouve : suppression de l'image du quiz +
  message de félicitations avec mention de l'utilisateur.

## ✏️ Personnalisation rapide

- Couleurs des difficultés : `DIFFICULTY_COLORS` dans `generateImage.js`
- Style du fond "Maroc" : `background.js`
- Intervalle entre les quiz : `QUIZ_INTERVAL` dans `index.js`
- Tolérance de réponse (actuellement égalité stricte après normalisation) :
  fonction `normalize()` dans `index.js` — tu peux passer à un `.includes()`
  pour accepter les réponses partielles.
