/**
 * Fond sombre élégant : dégradé bleu nuit → noir avec subtils reflets.
 */
function drawBackground(ctx, width, height) {
  // Dégradé principal sombre
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0,   '#0d0f1a');
  grad.addColorStop(0.5, '#111320');
  grad.addColorStop(1,   '#0a0c14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Reflet violet subtil en haut à gauche
  const spot1 = ctx.createRadialGradient(width * 0.15, height * 0.1, 0, width * 0.15, height * 0.1, width * 0.55);
  spot1.addColorStop(0,   'rgba(80, 40, 140, 0.18)');
  spot1.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot1;
  ctx.fillRect(0, 0, width, height);

  // Reflet bleu subtil en bas à droite
  const spot2 = ctx.createRadialGradient(width * 0.85, height * 0.9, 0, width * 0.85, height * 0.9, width * 0.5);
  spot2.addColorStop(0,   'rgba(30, 60, 120, 0.2)');
  spot2.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot2;
  ctx.fillRect(0, 0, width, height);
}

module.exports = { drawBackground };
