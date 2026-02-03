// ---- Canvas Setup ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dynamic resize to fill the screen while keeping 2:3 aspect ratio
function resizeCanvas() {
  const aspect = 2 / 3;
  let w = window.innerWidth;
  let h = window.innerHeight;
  if (w / h > aspect) {
    w = Math.floor(h * aspect);
  } else {
    h = Math.floor(w / aspect);
  }
  canvas.width = w;
  canvas.height = h;
  const container = document.getElementById('game-container');
  container.style.width = w + 'px';
  container.style.height = h + 'px';
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  W = canvas.width;
  H = canvas.height;
  C = getConstants();
});

let W = canvas.width;
let H = canvas.height;

// ---- UI Elements ----
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const restartBtn = document.getElementById('restart-btn');

// ---- Game Constants (scaled to screen) ----
// Base values tuned to match original Flappy Bird at 512px height
const BASE_H = 512;
function s(val) { return val * (H / BASE_H); }

function getConstants() {
  return {
    GRAVITY: s(0.22),
    FLAP_FORCE: s(-5.0),
    MAX_FALL_SPEED: s(7),
    PIPE_WIDTH: s(52),
    PIPE_GAP: s(110),
    PIPE_SPEED: s(2.2),
    PIPE_SPAWN_INTERVAL: 90,
    GROUND_HEIGHT: s(70),
    BIRD_X: s(70),
    BIRD_RADIUS: s(13),
  };
}
let C = getConstants();

// ---- Colors ----
const COLORS = {
  sky: '#70c5ce',
  skyGradient: '#4ec0ca',
  ground: '#ded895',
  groundDark: '#d2b748',
  groundStripe: '#c8a83e',
  pipeBody: '#73bf2e',
  pipeBorder: '#558b20',
  pipeCapTop: '#82d932',
  bird: '#f9c74f',
  birdDark: '#f08c00',
  birdEye: '#ffffff',
  birdPupil: '#000000',
  birdBeak: '#e85d04',
  birdWing: '#f3a712',
  scoreText: '#ffffff',
  scoreShadow: '#000000',
};

// ---- Game State ----
let gameState = 'start'; // start | playing | gameover
let bird, pipes, score, bestScore, frameCount, groundOffset;

function loadBestScore() {
  const saved = localStorage.getItem('flappyBirdBest');
  return saved ? parseInt(saved, 10) : 0;
}

function saveBestScore(s) {
  localStorage.setItem('flappyBirdBest', s);
}

function resetGame() {
  bird = {
    y: H / 2 - 50,
    vy: 0,
    rotation: 0,
    flapFrame: 0,
  };
  pipes = [];
  score = 0;
  frameCount = 0;
  groundOffset = 0;
  bestScore = loadBestScore();
  bestScoreEl.textContent = bestScore;
}

// ---- Bird Drawing ----
function drawBird() {
  ctx.save();
  ctx.translate(C.BIRD_X, bird.y);

  // Rotation based on velocity
  const targetRot = Math.min(bird.vy * 3, 70);
  bird.rotation += (targetRot - bird.rotation) * 0.15;
  ctx.rotate((bird.rotation * Math.PI) / 180);

  // Body
  ctx.fillStyle = COLORS.bird;
  ctx.beginPath();
  ctx.ellipse(0, 0, C.BIRD_RADIUS + 2, C.BIRD_RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.birdDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wing
  const wingFlap = Math.sin(bird.flapFrame * 0.3) * 5;
  ctx.fillStyle = COLORS.birdWing;
  ctx.beginPath();
  ctx.ellipse(-3, 3 + wingFlap, 10, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.birdDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Eye
  ctx.fillStyle = COLORS.birdEye;
  ctx.beginPath();
  ctx.arc(8, -5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Pupil
  ctx.fillStyle = COLORS.birdPupil;
  ctx.beginPath();
  ctx.arc(10, -5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = COLORS.birdBeak;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(24, 2);
  ctx.lineTo(14, 6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ---- Pipe Drawing ----
function drawPipe(pipe) {
  const capH = 26;
  const capOverhang = 5;

  // Top pipe body
  ctx.fillStyle = COLORS.pipeBody;
  ctx.fillRect(pipe.x, 0, C.PIPE_WIDTH, pipe.topH);
  ctx.strokeStyle = COLORS.pipeBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(pipe.x, 0, C.PIPE_WIDTH, pipe.topH);

  // Top pipe cap
  ctx.fillStyle = COLORS.pipeCapTop;
  ctx.fillRect(pipe.x - capOverhang, pipe.topH - capH, C.PIPE_WIDTH + capOverhang * 2, capH);
  ctx.strokeStyle = COLORS.pipeBorder;
  ctx.strokeRect(pipe.x - capOverhang, pipe.topH - capH, C.PIPE_WIDTH + capOverhang * 2, capH);

  // Pipe highlight (top)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(pipe.x + 6, 0, 8, pipe.topH - capH);

  // Bottom pipe body
  const bottomY = pipe.topH + C.PIPE_GAP;
  const bottomH = H - bottomY - C.GROUND_HEIGHT;
  ctx.fillStyle = COLORS.pipeBody;
  ctx.fillRect(pipe.x, bottomY, C.PIPE_WIDTH, bottomH);
  ctx.strokeStyle = COLORS.pipeBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(pipe.x, bottomY, C.PIPE_WIDTH, bottomH);

  // Bottom pipe cap
  ctx.fillStyle = COLORS.pipeCapTop;
  ctx.fillRect(pipe.x - capOverhang, bottomY, C.PIPE_WIDTH + capOverhang * 2, capH);
  ctx.strokeStyle = COLORS.pipeBorder;
  ctx.strokeRect(pipe.x - capOverhang, bottomY, C.PIPE_WIDTH + capOverhang * 2, capH);

  // Pipe highlight (bottom)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(pipe.x + 6, bottomY + capH, 8, bottomH - capH);
}

// ---- Background Drawing ----
function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H - C.GROUND_HEIGHT);
  grad.addColorStop(0, COLORS.sky);
  grad.addColorStop(1, COLORS.skyGradient);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H - C.GROUND_HEIGHT);

  // Clouds
  drawCloud(W * 0.12, H * 0.15, 0.8);
  drawCloud(W * 0.5, H * 0.28, 0.6);
  drawCloud(W * 0.8, H * 0.11, 0.5);
  drawCloud(W * 0.37, H * 0.37, 0.7);
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.arc(25, -5, 20, 0, Math.PI * 2);
  ctx.arc(50, 0, 25, 0, Math.PI * 2);
  ctx.arc(15, 10, 18, 0, Math.PI * 2);
  ctx.arc(35, 10, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Ground Drawing ----
function drawGround() {
  // Ground body
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, H - C.GROUND_HEIGHT, W, C.GROUND_HEIGHT);

  // Ground top line
  ctx.fillStyle = COLORS.groundDark;
  ctx.fillRect(0, H - C.GROUND_HEIGHT, W, 4);

  // Ground stripes
  ctx.fillStyle = COLORS.groundStripe;
  const stripeW = 30;
  for (let x = -groundOffset % (stripeW * 2); x < W; x += stripeW * 2) {
    ctx.fillRect(x, H - C.GROUND_HEIGHT + 4, stripeW, 12);
  }
}

// ---- Score Drawing ----
function drawScore() {
  ctx.save();
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.scoreShadow;
  ctx.fillText(score, W / 2 + 2, 62);
  ctx.fillStyle = COLORS.scoreText;
  ctx.fillText(score, W / 2, 60);
  ctx.restore();
}

// ---- Collision Detection ----
function checkCollision() {
  // Ground / ceiling
  if (bird.y + C.BIRD_RADIUS > H - C.GROUND_HEIGHT || bird.y - C.BIRD_RADIUS < 0) {
    return true;
  }

  // Pipes
  for (const pipe of pipes) {
    const withinX = C.BIRD_X + C.BIRD_RADIUS > pipe.x && C.BIRD_X - C.BIRD_RADIUS < pipe.x + C.PIPE_WIDTH;
    if (withinX) {
      const hitTop = bird.y - C.BIRD_RADIUS < pipe.topH;
      const hitBottom = bird.y + C.BIRD_RADIUS > pipe.topH + C.PIPE_GAP;
      if (hitTop || hitBottom) {
        return true;
      }
    }
  }

  return false;
}

// ---- Game Logic ----
function flap() {
  if (gameState === 'start') {
    gameState = 'playing';
    startScreen.classList.add('hidden');
    resetGame();
  }

  if (gameState === 'playing') {
    bird.vy = C.FLAP_FORCE;
    bird.flapFrame = 0;
  }
}

function update() {
  if (gameState !== 'playing') return;

  // Bird physics
  bird.vy += C.GRAVITY;
  if (bird.vy > C.MAX_FALL_SPEED) bird.vy = C.MAX_FALL_SPEED;
  bird.y += bird.vy;
  bird.flapFrame++;

  // Ground scroll
  groundOffset += C.PIPE_SPEED;

  // Spawn pipes
  frameCount++;
  if (frameCount % C.PIPE_SPAWN_INTERVAL === 0) {
    const minTop = s(60);
    const maxTop = H - C.GROUND_HEIGHT - C.PIPE_GAP - s(60);
    const topH = Math.random() * (maxTop - minTop) + minTop;
    pipes.push({ x: W, topH: topH, scored: false });
  }

  // Move pipes and score
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= C.PIPE_SPEED;

    // Score when bird passes pipe
    if (!pipes[i].scored && pipes[i].x + C.PIPE_WIDTH < C.BIRD_X) {
      pipes[i].scored = true;
      score++;
    }

    // Remove off-screen pipes
    if (pipes[i].x + C.PIPE_WIDTH + 10 < 0) {
      pipes.splice(i, 1);
    }
  }

  // Collision
  if (checkCollision()) {
    gameState = 'gameover';
    if (score > bestScore) {
      bestScore = score;
      saveBestScore(bestScore);
    }
    finalScoreEl.textContent = score;
    bestScoreEl.textContent = bestScore;
    gameOverScreen.classList.remove('hidden');
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  pipes.forEach(drawPipe);
  drawGround();
  drawBird();
  if (gameState === 'playing') {
    drawScore();
  }
}

// ---- Game Loop ----
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ---- Input Handling ----
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    flap();
  }
});

canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  flap();
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  gameOverScreen.classList.add('hidden');
  gameState = 'playing';
  resetGame();
});

// ---- Init ----
resetGame();
draw();
gameLoop();
