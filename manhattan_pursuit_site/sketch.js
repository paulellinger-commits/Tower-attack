// Manhattan Pursuit – p5.js browser edition
let planeX = 160, planeY, velocity = 0;
let towerX, towerSpeed = 3, towerWidth = 105, gapSize = 190, gapY;
let score = 0;
const NORMAL = 0, DAMAGED = 1, CHASE = 2, GAMEOVER = 3, BOSS = 4;
let phase = NORMAL, phaseTimer = 0, towerHit = false;
let redAmount = 0, planeAngle = 0;
let militaryXs = [-180, -330, -480, -630];
let militaryYs = [250, 350, 300, 420];
let militaryOffsets = [-95, 35, -35, 105];
let militaryTowerHit = false, militaryCrashFlash = 0;
let upperDestroyed = false, lowerDestroyed = false;
let bossHealth = 100, bossTimer = 0, bossShots = [], playerShots = [], bossY = 350, bossDirection = 1;
let upperDamaged = false, lowerDamaged = false;
let buildingDamageY, buildingExplosionTimer = 0;
let px = Array(70).fill(0), py = Array(70).fill(0), pvx = Array(70).fill(0), pvy = Array(70).fill(0), ps = Array(70).fill(0);
let gameStarted = false;

function setup() {
  const c = createCanvas(600, 700);
  c.parent('game-container');
  frameRate(60);
  resetGame();
  document.getElementById('play-button').addEventListener('click', startGame);
}

function startGame() {
  if (phase === GAMEOVER) resetGame();
  gameStarted = true;
  document.getElementById('start-screen').style.display = 'none';
  updateHud();
}

function draw() {
  if (gameStarted) updateGame();
  if (phase === BOSS) drawDesertBackground();
  else { drawBackground(); drawCinematicEffects(); }
  if (phase !== BOSS) {
    if (!upperDestroyed) drawSkyscraper(towerX, 0, gapY - gapSize / 2, true, upperDamaged);
    if (!lowerDestroyed) drawSkyscraper(towerX, gapY + gapSize / 2, height - 15, false, lowerDamaged);
  }
  if (buildingExplosionTimer > 0) updateBuildingExplosion();
  if (phase !== GAMEOVER) drawPlane();
  if (phase === DAMAGED || phase === CHASE) drawSmokeTrail();
  if (phase === CHASE) {
    for (let i = 0; i < militaryXs.length; i++) drawMilitaryPlane(militaryXs[i], militaryYs[i], 1 - i * 0.09);
    if (militaryCrashFlash > 0) { fill(255, 190, 80, militaryCrashFlash * 5); textSize(22); text('PURSUER CRASH!', width/2, 145); }
  }
  if (phase === BOSS) drawBossFight();
  fill(255); noStroke(); textAlign(CENTER); textSize(38); text(score, width / 2, 65);
  if (phase === DAMAGED) { fill(255, 210, 100); textSize(17); text('AIRCRAFT DAMAGED', width / 2, 105); }
  if (phase === CHASE) { fill(255, 80, 70); textSize(20); text('PURSUIT!', width / 2, 105); }
  if (phase === BOSS) { fill(255, 225, 160); textSize(17); text('DESERT BOSS ARENA  •  X TO FIRE', width/2, 105); }
  if (phase === GAMEOVER) {
    fill(0, 185); noStroke(); rect(0, 0, width, height);
    fill(255); textSize(45); text('GAME OVER', width / 2, 315);
    textSize(25); text('Score: ' + score, width / 2, 365);
    textSize(18); text('SPACE / TAP TO RESTART', width / 2, 420);
  }
  updateHud();
}

function updateHud() {
  const status = phase === NORMAL ? 'IN FLIGHT' : phase === DAMAGED ? 'AIRCRAFT DAMAGED' : phase === CHASE ? 'PURSUIT ACTIVE' : phase === BOSS ? 'DESERT BOSS FIGHT' : 'FLIGHT ENDED';
  const s = document.getElementById('status-label');
  const sc = document.getElementById('score-label');
  if (s) s.textContent = status;
  if (sc) sc.textContent = String(score).padStart(3, '0');
}

function updateGame() {
  if (phase === GAMEOVER) return;
  phaseTimer++;
  if (phase === BOSS) { updateBossFight(); return; }
  if (phase === NORMAL) { towerSpeed = 3; gapSize = 190; }
  if (phase === DAMAGED) { towerSpeed = 3.8; gapSize = 175; redAmount = min(0.5, redAmount + 0.003); }
  if (phase === CHASE) {
    towerSpeed = min(7.5, 4.5 + phaseTimer / 600.0);
    gapSize = max(130, 170 - phaseTimer * 0.025);
    redAmount = min(0.8, redAmount + 0.001);
    for (let i = 0; i < militaryXs.length; i++) {
      const targetX = 20 - i * 105;
      // Verfolger reagieren absichtlich träge auf Richtungswechsel des Spielers.
      militaryXs[i] = lerp(militaryXs[i], targetX, 0.018 + i * 0.002);
      const targetY = constrain(planeY + militaryOffsets[i], 55, height - 65);
      militaryYs[i] = lerp(militaryYs[i], targetY, 0.012 + i * 0.001);
    }
    checkMilitaryTowerCollision();
    if (militaryCrashFlash > 0) militaryCrashFlash--;
    if (score >= 10) startBossFight();
  }
  let currentGravity = phase === NORMAL ? 0.45 : phase === DAMAGED ? 0.68 : 0.82;
  velocity += currentGravity; planeY += velocity;
  if (phase === DAMAGED || phase === CHASE) planeAngle = lerp(planeAngle, 0.65, 0.035);
  else planeAngle = lerp(planeAngle, velocity * 0.035, 0.1);
  towerX -= towerSpeed;
  if (towerX < -towerWidth - 20) {
    towerX = width;
    gapY = random(190 + gapSize / 2, 510 - gapSize / 2);
    towerHit = false; militaryTowerHit = false; upperDamaged = false; lowerDamaged = false; upperDestroyed = false; lowerDestroyed = false;
  }
  if (towerX + towerWidth < planeX && !towerHit) { score++; towerHit = true; }
  if (planeY < 0 || planeY > height - 15) { phase = GAMEOVER; redAmount = 1; return; }
  const horizontalCollision = planeX + 22 > towerX && planeX - 22 < towerX + towerWidth;
  if (horizontalCollision) {
    const hitUpper = !upperDestroyed && planeY - 13 < gapY - gapSize / 2;
    const hitLower = !lowerDestroyed && planeY + 13 > gapY + gapSize / 2;
    if ((hitUpper || hitLower) && !towerHit) {
      if (phase === NORMAL) {
        startBuildingDamage(hitUpper); phase = DAMAGED; phaseTimer = 0;
        velocity = 2.5; planeAngle = 0.2; towerHit = true;
      } else { phase = GAMEOVER; redAmount = 1; }
    }
  }
  if (phase === DAMAGED && phaseTimer >= 180) {
    phase = CHASE; phaseTimer = 0;
    for (let i = 0; i < militaryXs.length; i++) { militaryXs[i] = -180 - i * 150; militaryYs[i] = planeY + militaryOffsets[i] * 0.4; }
  }
}

function checkMilitaryTowerCollision() {
  if (militaryTowerHit) return;
  for (let i = 0; i < militaryXs.length; i++) {
    const x = militaryXs[i], y = militaryYs[i];
    const overlaps = x + 38 > towerX && x - 38 < towerX + towerWidth;
    if (!overlaps) continue;
    const hitsTop = y - 13 < gapY - gapSize / 2;
    const hitsBottom = y + 13 > gapY + gapSize / 2;
    if ((hitsTop && !upperDestroyed) || (hitsBottom && !lowerDestroyed)) {
      // Der Einschlag lässt den gesamten Turm einstürzen.
      upperDestroyed = true; lowerDestroyed = true;
      upperDamaged = true; lowerDamaged = true;
    } else continue;
    startBuildingDamage(hitsTop);
    militaryTowerHit = true;
    militaryCrashFlash = 36;
    militaryXs[i] = -220 - i * 80; // der Verfolger wird nach dem Einschlag zurückgesetzt
    break;
  }
}

function startBossFight() {
  phase = BOSS; phaseTimer = 0; bossTimer = 0; bossHealth = 100;
  bossShots = []; playerShots = []; bossY = height / 2; bossDirection = 1;
  redAmount = 0;
}

function drawDesertBackground() {
  background(218, 145, 75);
  noStroke();
  fill(245, 190, 105); ellipse(470, 145, 155, 155);
  fill(177, 105, 62); triangle(0, 490, 165, 210, 335, 490); triangle(210, 500, 430, 245, 650, 500);
  fill(194, 119, 66); triangle(0, 560, 145, 355, 300, 560); triangle(300, 570, 475, 365, 650, 570);
  fill(154, 91, 52); rect(0, height - 55, width, 55);
  fill(238, 176, 102, 100); for (let i=0;i<8;i++) ellipse((i*107 + frameCount*0.7)%700-50, 575+(i%3)*25, 130, 20);
  fill(70, 58, 48); rect(0, height-15, width, 15);
}

function drawBossFight() {
  // Boss health bar
  fill(35, 25, 25, 190); rect(115, 28, 370, 18, 8);
  fill(210, 55, 40); rect(118, 31, 364 * bossHealth/100, 12, 6);
  fill(255); textAlign(CENTER); textSize(13); text('DESERT SENTINEL', width/2, 22);
  // stylisierter Boss-Gegner
  push(); translate(455, bossY); noStroke();
  fill(65, 76, 65); ellipse(0, 0, 100, 34); triangle(-15,-8,-62,-48,42,-8); triangle(-15,8,-62,48,42,8);
  fill(255, 170, 60); ellipse(-30, 0, 12, 12); fill(120, 205, 225); ellipse(27,-5,18,8); pop();
  // Spieler-Projektile
  for (const shot of playerShots) { fill(110, 235, 255); ellipse(shot.x, shot.y, 13, 6); }
  // Boss-Angriffe
  for (const shot of bossShots) { fill(255, 205, 90); ellipse(shot.x, shot.y, 18, 18); }
  fill(255, 235, 205); textSize(15); text('SPACE / TAP: FLIEGEN     X: ENERGIEPULS', width/2, height-28);
  if (bossHealth <= 0) {
    fill(20, 30, 25, 190); rect(0,0,width,height);
    fill(255, 230, 150); textSize(42); text('ARENA CLEARED', width/2, 320);
    textSize(19); text('YOU SURVIVED THE DESERT', width/2, 365);
    textSize(16); text('SPACE / TAP TO PLAY AGAIN', width/2, 415);
  }
}

function updateBossFight() {
  bossTimer++;
  velocity += 0.42; planeY += velocity;
  planeY = constrain(planeY, 25, height-70);
  planeAngle = lerp(planeAngle, velocity*0.025, 0.08);
  bossY += bossDirection * (1.5 + sin(bossTimer*0.025));
  if (bossY < 115 || bossY > 560) bossDirection *= -1;
  if (bossTimer % 75 === 0) bossShots.push({x:410, y:bossY, vx:-4.4, vy:random(-1.6,1.6)});
  for (const shot of bossShots) { shot.x += shot.vx; shot.y += shot.vy; }
  bossShots = bossShots.filter(shot => shot.x > -30);
  for (const shot of playerShots) { shot.x += 7; }
  for (let i=playerShots.length-1;i>=0;i--) {
    const shot=playerShots[i];
    if (dist(shot.x,shot.y,455,bossY)<55) { bossHealth=max(0,bossHealth-8); playerShots.splice(i,1); }
    else if (shot.x>width+20) playerShots.splice(i,1);
  }
  for (const shot of bossShots) {
    if (dist(shot.x,shot.y,planeX,planeY)<23) { shot.x=-100; velocity=-5; }
  }
  if (planeY < 18 || planeY > height-60) { planeY=constrain(planeY,18,height-60); velocity *= -0.55; }
}

function startBuildingDamage(upper) {
  if (upper) { upperDamaged = true; lowerDamaged = false; buildingDamageY = gapY - gapSize / 2; }
  else { lowerDamaged = true; upperDamaged = false; buildingDamageY = gapY + gapSize / 2; }
  buildingExplosionTimer = 35;
  for (let i = 0; i < px.length; i++) {
    px[i] = towerX + random(20, 100); py[i] = buildingDamageY + random(-15, 15);
    const angle = random(TWO_PI), speed = random(2, 11);
    pvx[i] = cos(angle) * speed; pvy[i] = sin(angle) * speed; ps[i] = random(4, 13);
  }
}

function updateBuildingExplosion() {
  buildingExplosionTimer--;
  if (buildingExplosionTimer > 20) {
    fill(255, 170, 40, 160); noStroke();
    const d = (35 - buildingExplosionTimer) * 9;
    ellipse(towerX + 50, buildingDamageY, d, d);
  }
  for (let i = 0; i < px.length; i++) {
    px[i] += pvx[i]; py[i] += pvy[i]; pvx[i] *= 0.96; pvy[i] *= 0.96; pvy[i] += 0.15;
    fill(80, 70, 65, 220); noStroke(); rect(px[i], py[i], ps[i], ps[i]);
  }
}

function drawSkyscraper(x, top, bottom, upper, damagedBuilding) {
  const h = bottom - top; noStroke();
  fill(85, 90, 105); rect(x, top, towerWidth, h);
  fill(45, 55, 70); rect(x + 93, top, 12, h);
  fill(125, 130, 140); rect(x, top, 6, h); rect(x + 45, top, 4, h);
  for (let row = 0; row < h / 27; row++) for (let col = 0; col < 4; col++) {
    const wx = x + 12 + col * 23, wy = top + 10 + row * 27;
    let broken = false;
    if (damagedBuilding) broken = upper ? wy > bottom - 75 : wy < top + 75;
    if (!broken) { const pattern = (row * 7 + col * 13) % 5; fill(pattern !== 0 ? color(235, 200, 135) : color(35, 55, 75)); rect(wx, wy, 13, 17); }
  }
  stroke(40, 45, 55); strokeWeight(1);
  for (let y = top + 27; y < bottom; y += 27) line(x, y, x + 105, y);
  noStroke(); fill(55, 65, 80);
  if (upper) { rect(x + 15, bottom - 30, 75, 30); rect(x + 25, bottom - 43, 55, 13); rect(x + 37, bottom - 55, 31, 12); }
  else { rect(x + 15, top, 75, 30); rect(x + 25, top - 13, 55, 13); rect(x + 37, top - 25, 31, 12); }
  if (damagedBuilding) {
    const dy = upper ? bottom - 25 : top + 25; fill(35, 30, 35);
    beginShape(); vertex(x + 12, dy - 20); vertex(x + 28, dy - 8); vertex(x + 37, dy - 25); vertex(x + 52, dy + 4); vertex(x + 67, dy - 15); vertex(x + 85, dy + 12); vertex(x + 95, dy - 10); vertex(x + 95, dy + 30); vertex(x + 12, dy + 30); endShape(CLOSE);
    stroke(155, 145, 125); strokeWeight(3); line(x + 28, dy - 8, x + 37, dy - 25); line(x + 52, dy + 4, x + 67, dy - 15); noStroke();
    for (let i = 0; i < 6; i++) { const sx = x + 35 + i * 10; fill(55, 55, 60, 90); ellipse(sx + sin(frameCount * 0.04 + i) * 8, dy - 30 - i * 12, 30 + i * 4, 25 + i * 4); }
  }
  stroke(35, 40, 50); strokeWeight(3); line(x, top, x, bottom); line(x + 105, top, x + 105, bottom); noStroke();
}

function drawPlane() {
  push(); translate(planeX, planeY); rotate(planeAngle); noStroke();
  fill(85); ellipse(-5, 8, 12, 6);
  fill(phase === NORMAL ? 205 : 95, phase === NORMAL ? 205 : 85, phase === NORMAL ? 205 : 75);
  triangle(-5, -3, -20, -23, 12, -3);
  if (phase === NORMAL) triangle(-5, 3, -20, 23, 12, 3); else triangle(-5, 3, -14, 15, 8, 3);
  fill(phase === NORMAL ? color(245) : color(105, 95, 80)); ellipse(0, 0, 48, 16);
  fill(60, 130, 160); ellipse(13, -2, 12, 8);
  fill(phase === NORMAL ? color(200, 40, 40) : color(65, 45, 40)); triangle(-19, -3, -27, -15, -12, -3);
  if (phase !== NORMAL) { fill(30); ellipse(-12, 5, 9, 5); fill(255, 120, 20); ellipse(-18, 10, 5, 5); }
  pop();
}

function drawSmokeTrail() {
  for (let i = 0; i < 7; i++) {
    const sx = planeX - 25 - i * 15, sy = planeY + sin(frameCount * 0.1 + i) * 7;
    noStroke(); fill(65, 65, 70, 90 - i * 8); ellipse(sx, sy, 16 + i * 5, 13 + i * 4);
  }
}

function drawMilitaryPlane(x, y, s) {
  push(); translate(x, y + sin(frameCount * 0.07 + x) * 5); scale(s); noStroke();
  fill(255, 125, 35, 100); ellipse(-42, 1, 30, 13); fill(255, 205, 110, 180); ellipse(-39, 1, 16, 6);
  fill(65, 78, 68); ellipse(0, 0, 78, 17); triangle(-8, -5, -37, -31, 31, -5); triangle(-8, 5, -37, 31, 31, 5);
  fill(48, 60, 53); triangle(-29, -4, -42, -19, -12, -4); triangle(-29, 4, -42, 19, -12, 4);
  fill(105, 175, 205); ellipse(22, -3, 15, 7); fill(205, 225, 225, 100); ellipse(24, -4, 6, 2);
  fill(255, 65, 45); ellipse(-8, -23, 4, 4); fill(80, 190, 255); ellipse(-8, 23, 4, 4); pop();
}

function drawCinematicEffects() {
  if (phase === CHASE) {
    stroke(255, 205, 150, 65); strokeWeight(2);
    for (let i = 0; i < 13; i++) { const x = (frameCount * 11 + i * 79) % (width + 100) - 50, y = (i * 61 + frameCount * 3) % height; line(x, y, x - 35 - random(20), y + random(-3, 3)); }
    noStroke(); const pulse = 35 + sin(frameCount * 0.18) * 20; noFill(); stroke(255, 45, 30, pulse); strokeWeight(12); rect(6, 6, width - 12, height - 12, 18); noStroke();
  }
  noFill(); stroke(10, 12, 22, phase === CHASE ? 115 : 55); strokeWeight(28); rect(0, 0, width, height); noStroke();
  if ((phase === DAMAGED && phaseTimer < 12) || (phase === CHASE && phaseTimer < 18)) {
    const alpha = phase === DAMAGED ? 95 - phaseTimer * 7 : 70 - phaseTimer * 4;
    fill(255, 220, 170, max(0, alpha)); rect(0, 0, width, height);
  }
}

function drawBackground() {
  const normalSky = color(90, 155, 205), redSky = color(95, 12, 25);
  background(lerpColor(normalSky, redSky, redAmount)); noStroke();
  fill(255, 195, 120, 65); ellipse(440, 230, 270, 270); fill(255, 205, 125); ellipse(440, 230, 125, 125);
  fill(redAmount > 0.15 ? color(55, 35, 48, 125) : color(225, 235, 245, 95));
  drawCloud(90, 130); drawCloud(300, 180); drawCloud(520, 100); fill(65, 45, 55, 90); drawCloud(180, 245); drawCloud(470, 285);
  if (redAmount > 0.1) { stroke(255, 145, 90, 28 + redAmount * 25); strokeWeight(3); for (let i = -2; i <= 2; i++) line(440, 230, 440 + i * 190, 700); noStroke(); }
  fill(65, 85, 110); rect(0, 420, 60, 280); rect(65, 350, 65, 350); rect(140, 450, 60, 250);
  rect(215, 330, 65, 370); rect(225, 305, 45, 25); rect(238, 275, 18, 30); rect(245, 235, 5, 40);
  rect(300, 405, 75, 295); rect(385, 340, 65, 360); rect(460, 430, 65, 270); rect(535, 365, 80, 335);
  fill(255, 205, 115, 180); for (let i = 0; i < 100; i++) { const x = (i * 47) % width, y = 360 + (i * 31) % 300; rect(x, y, 5, 10); }
  fill(45, 55, 70); rect(0, height - 15, width, 15);
  if (redAmount > 0) { fill(180, 0, 0, redAmount * 55); rect(0, 0, width, height); }
}
function drawCloud(x, y) { noStroke(); ellipse(x, y, 80, 35); ellipse(x + 25, y - 15, 60, 45); ellipse(x + 55, y, 70, 35); }

function flap() {
  if (!gameStarted) { startGame(); return; }
  if (phase === GAMEOVER) { resetGame(); return; }
  velocity = phase === NORMAL ? -8 : phase === DAMAGED ? -8.5 : -9.5;
}
function keyPressed() { if (phase === BOSS && (key === 'x' || key === 'X')) { if (bossHealth > 0) playerShots.push({x:planeX+24,y:planeY}); return false; } if (key === ' ' || keyCode === UP_ARROW) { if (phase === BOSS && bossHealth <= 0) { resetGame(); return false; } flap(); return false; } }
function mousePressed() { if (phase === BOSS && bossHealth <= 0) { resetGame(); return; } if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) flap(); }
function touchStarted() { if (phase === BOSS && bossHealth <= 0) resetGame(); else if (touches.length > 0) flap(); return false; }

function resetGame() {
  planeY = height / 2; velocity = 0; towerX = width; gapSize = 190; gapY = random(285, 415); towerSpeed = 3; score = 0;
  phase = NORMAL; phaseTimer = 0; towerHit = false; militaryTowerHit = false; upperDamaged = false; lowerDamaged = false; upperDestroyed = false; lowerDestroyed = false;
  buildingExplosionTimer = 0; redAmount = 0; planeAngle = 0; militaryCrashFlash = 0;
  bossHealth = 100; bossTimer = 0; bossShots = []; playerShots = [];
  for (let i = 0; i < militaryXs.length; i++) { militaryXs[i] = -180 - i * 150; militaryYs[i] = planeY + militaryOffsets[i] * 0.4; }
}
