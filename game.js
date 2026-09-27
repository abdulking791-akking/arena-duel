// ---------- Setup ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const PLAYER_RADIUS = 22;
const PLAYER_SPEED = 3.2;
const BULLET_RADIUS = 6;
const BULLET_SPEED = 9;
const BULLET_DAMAGE = 10;
const SHOOT_COOLDOWN = 300; // ms between shots

let bullets = [];
let gameOver = false;

const p1 = { x: 0, y: 0, angle: 0, hp: 100, color: '#4CAF50', lastShot: 0, moving: false };
const p2 = { x: 0, y: 0, angle: Math.PI, hp: 100, color: '#E53935', lastShot: 0, moving: false };

function resetGame() {
  p1.x = canvas.width * 0.25; p1.y = canvas.height / 2; p1.hp = 100; p1.angle = 0;
  p2.x = canvas.width * 0.75; p2.y = canvas.height / 2; p2.hp = 100; p2.angle = Math.PI;
  bullets = [];
  gameOver = false;
  document.getElementById('winScreen').classList.add('hidden');
  updateHealthBars();
}

// ---------- Joystick handling ----------
function setupJoystick(joystickId, player) {
  const joystick = document.getElementById(joystickId);
  const stick = joystick.querySelector('.stick');
  let touchId = null;
  let vector = { x: 0, y: 0 };

  function getCenter() {
    const rect = joystick.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function handleMove(clientX, clientY) {
    const center = getCenter();
    let dx = clientX - center.x;
    let dy = clientY - center.y;
    const dist = Math.min(Math.hypot(dx, dy), 45);
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;
    stick.style.transform = `translate(${dx - 25}px, ${dy - 25}px)`;

    if (Math.hypot(dx, dy) > 10) {
      vector.x = Math.cos(angle);
      vector.y = Math.sin(angle);
      player.angle = angle;
      player.moving = true;
    } else {
      player.moving = false;
    }
  }

  function resetStick() {
    stick.style.transform = 'translate(-50%, -50%)';
    player.moving = false;
    vector = { x: 0, y: 0 };
  }

  joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    touchId = t.identifier;
    handleMove(t.clientX, t.clientY);
  });

  joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) handleMove(t.clientX, t.clientY);
    }
  });

  joystick.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        touchId = null;
        resetStick();
      }
    }
  });

  return () => vector;
}

const getP1Vector = setupJoystick('joystick1', p1);
const getP2Vector = setupJoystick('joystick2', p2);

// ---------- Shooting ----------
function shoot(player) {
  const now = Date.now();
  if (now - player.lastShot < SHOOT_COOLDOWN || gameOver) return;
  player.lastShot = now;
  bullets.push({
    x: player.x + Math.cos(player.angle) * (PLAYER_RADIUS + 5),
    y: player.y + Math.sin(player.angle) * (PLAYER_RADIUS + 5),
    angle: player.angle,
    owner: player
  });
}

document.getElementById('shoot1').addEventListener('touchstart', (e) => { e.preventDefault(); shoot(p1); });
document.getElementById('shoot2').addEventListener('touchstart', (e) => { e.preventDefault(); shoot(p2); });

// ---------- Health & win screen ----------
function updateHealthBars() {
  document.getElementById('hp1').style.width = Math.max(0, p1.hp) + '%';
  document.getElementById('hp2').style.width = Math.max(0, p2.hp) + '%';
}

function endGame(winnerLabel) {
  gameOver = true;
  document.getElementById('winText').textContent = winnerLabel + ' Wins!';
  document.getElementById('winScreen').classList.remove('hidden');
}

document.getElementById('replayBtn').addEventListener('click', resetGame);

// ---------- Game loop ----------
function update() {
  if (gameOver) return;

  const v1 = getP1Vector();
  const v2 = getP2Vector();

  if (p1.moving) {
    p1.x += v1.x * PLAYER_SPEED;
    p1.y += v1.y * PLAYER_SPEED;
  }
  if (p2.moving) {
    p2.x += v2.x * PLAYER_SPEED;
    p2.y += v2.y * PLAYER_SPEED;
  }

  // keep players inside arena
  [p1, p2].forEach(p => {
    p.x = Math.max(PLAYER_RADIUS, Math.min(canvas.width - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(canvas.height - PLAYER_RADIUS, p.y));
  });

  // move bullets
  bullets.forEach(b => {
    b.x += Math.cos(b.angle) * BULLET_SPEED;
    b.y += Math.sin(b.angle) * BULLET_SPEED;
  });

  // collisions: bullet vs opposite player
  bullets = bullets.filter(b => {
    const target = b.owner === p1 ? p2 : p1;
    const dist = Math.hypot(b.x - target.x, b.y - target.y);
    if (dist < PLAYER_RADIUS + BULLET_RADIUS) {
      target.hp -= BULLET_DAMAGE;
      updateHealthBars();
      if (target.hp <= 0) {
        endGame(target === p1 ? 'Player 2' : 'Player 1');
      }
      return false; // remove bullet on hit
    }
    // remove bullet if off-screen
    return b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height;
  });
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  // little "gun" line showing facing direction
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(PLAYER_RADIUS + 10, 0);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawPlayer(p1);
  drawPlayer(p2);

  ctx.fillStyle = 'yellow';
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

resetGame();
loop();