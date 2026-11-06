/**
 * Sound & Confetti micro-interactions for WorkSync
 * Uses pure HTML5 Canvas and Web Audio API — 0 external npm dependencies, 0 latency.
 */

export function playSuccessChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Uplifting two-tone chime (F5 -> C6)
    playTone(698.46, 0.0, 0.25);
    playTone(1046.50, 0.12, 0.45);
  } catch (err) {
    // Audio might be blocked by browser autoplay policy
  }
}

export function triggerHaptic(ms = 20) {
  if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}

export function triggerConfetti() {
  if (typeof window === 'undefined') return;
  playSuccessChime();
  triggerHaptic(30);

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5856D6', '#FFCC00'];
  const confettiCount = 90;
  const particles: any[] = [];

  for (let i = 0; i < confettiCount; i++) {
    particles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.4,
      r: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 10 + 6),
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  let animationFrame: number;
  const startTime = Date.now();

  const draw = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > 2200) {
      cancelAnimationFrame(animationFrame);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
      return;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rot += p.vRot;
      p.opacity = Math.max(0, 1 - elapsed / 2200);

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
      ctx.restore();
    }

    animationFrame = requestAnimationFrame(draw);
  };

  draw();
}
