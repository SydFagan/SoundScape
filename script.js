/* ============================================================
   SoundScape Mood Map — application logic
   ------------------------------------------------------------
   Architecture:
     • Mood            — one emotional state (data + behavior)
     • MoodController  — manages all moods and transitions
     • Atmosphere      — drifting particle canvas (background)
   ============================================================ */


/* ============================================================
   Mood — represents one emotional state.
   It owns its palette, its <audio> element, and the methods
   that apply its visuals and control its sound.
   ============================================================ */
class Mood {
  constructor({ name, label, palette, audioElement }) {
    this.name = name;
    this.label = label;
    this.palette = palette;          
    this.audio = audioElement;      
    this.audio.volume = 0;          
    this.fadeRaf = null;          
  }

  /* Apply the mood's visual atmosphere the overlay
     and the particle palette.  */
  applyVisuals() {
    const overlay = document.getElementById('mood-overlay');
    const isAlreadyActive = parseFloat(getComputedStyle(overlay).opacity) > 0.5;

    const setColors = () => {
      overlay.style.setProperty('--mood-c1', this.palette.c1 + 'aa');
      overlay.style.setProperty('--mood-c2', this.palette.c2 + '55');
    };

    if (isAlreadyActive) {
      // Fade out, swap colors, fade back in 
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.55,
        ease: 'power2.in',
        onComplete: () => {
          setColors();
          gsap.to(overlay, { opacity: 1, duration: 1.0, ease: 'power2.out' });
        }
      });
    } else {
      setColors();
      gsap.to(overlay, { opacity: 1, duration: 1.4, ease: 'power2.inOut' });
    }

    window.atmosphere.setPalette(this.palette);
  }

  /* Fade the audio volume to a target over `durationMs`.
     Uses requestAnimationFrame so it stays smooth and cancellable. */
  _fadeTo(targetVolume, durationMs, onComplete) {
    cancelAnimationFrame(this.fadeRaf);
    const startVolume = this.audio.volume;
    const startTime = performance.now();

    const step = (now) => {
      const t = Math.min((now - startTime) / durationMs, 1);
  
      const eased = 1 - Math.pow(1 - t, 2);
      this.audio.volume = startVolume + (targetVolume - startVolume) * eased;
      if (t < 1) {
        this.fadeRaf = requestAnimationFrame(step);
      } else if (onComplete) {
        onComplete();
      }
    };
    this.fadeRaf = requestAnimationFrame(step);
  }
  /* Begin playback of this mood's audio. Resets to start, then fades in. */
  startSound(targetVolume) {
    this.audio.currentTime = 0;
    
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => console.warn('Audio play blocked:', err));
    }
    this._fadeTo(targetVolume, 1500);
  }
  stopSound() {
    this._fadeTo(0, 700, () => this.audio.pause());
  }
}


/* ============================================================
   MoodController — the central system that manages all moods.
   It handles user selection, screen transitions, audio,
   and the API call that fetches a new "thought" for each mood.
   ============================================================ */
class MoodController {
  constructor() {
    this.moods = {};
    this.currentMood = null;
    this.volume = 0.4;    
  }

  register(mood) {
    this.moods[mood.name] = mood;
  }

  setVolume(v) {
    this.volume = v;
    if (this.currentMood) {
      this.currentMood.audio.volume = v;
    }
  }


  setMood(name) {
    const mood = this.moods[name];
    if (!mood) return;

    const wasInactive = !this.currentMood;

    
    if (this.currentMood && this.currentMood !== mood) {
      this.currentMood.stopSound();
    }

    this.currentMood = mood;
    mood.startSound(this.volume);
    mood.applyVisuals();

  
    if (wasInactive) this.transitionToActive();

    document.getElementById('status').textContent = mood.label.toLowerCase();
    this._updateSwitcher();
    this.refreshAdvice();
  }

  /* Animate the selection screen out and the active screen in. */
  transitionToActive() {
    const sel      = document.getElementById('selection');
    const active   = document.getElementById('active');
    const controls = document.getElementById('controls');
    const breath   = document.getElementById('breath');
    const switcher = document.getElementById('switcher');

    gsap.to(sel, {
      opacity: 0, y: -30, duration: 0.7, ease: 'power3.in',
      onComplete: () => sel.style.display = 'none'
    });

    active.classList.add('on');
    gsap.fromTo(active,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1.2, delay: 0.5, ease: 'power3.out' });

    controls.classList.add('on');
    breath.classList.add('on');
    switcher.classList.add('on');
  }


  transitionToSelection() {
    if (this.currentMood) {
      this.currentMood.stopSound();
      this.currentMood = null;
    }

    const sel      = document.getElementById('selection');
    const active   = document.getElementById('active');
    const overlay  = document.getElementById('mood-overlay');
    const controls = document.getElementById('controls');
    const breath   = document.getElementById('breath');
    const switcher = document.getElementById('switcher');

    gsap.to(active, {
      opacity: 0, y: 30, duration: 0.6, ease: 'power3.in',
      onComplete: () => active.classList.remove('on')
    });
    gsap.to(overlay, { opacity: 0, duration: 1.1, ease: 'power2.inOut' });
    controls.classList.remove('on');
    breath.classList.remove('on');
    switcher.classList.remove('on');

    sel.style.display = '';
    gsap.fromTo(sel,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 1.0, delay: 0.4, ease: 'power3.out' });

    window.atmosphere.setPalette(null);
    document.getElementById('status').textContent = 'awaiting';
    this._updateSwitcher();
  }


  _updateSwitcher() {
    document.querySelectorAll('.switch-dot').forEach(dot => {
      dot.classList.toggle('active',
        this.currentMood && dot.dataset.mood === this.currentMood.name);
    });
  }

  /* API call: fetch a new piece of "advice" and display it. */
  async refreshAdvice() {
    const textEl   = document.getElementById('quote-text');
    const sourceEl = document.getElementById('quote-source');

    gsap.to('.quote', { opacity: 0.25, duration: 0.4 });

    let advice, source;
    try {
  
      const res = await fetch('https://api.adviceslip.com/advice?t=' + Date.now());
      const data = await res.json();
      advice = data.slip.advice;
      source = 'advice slip №' + data.slip.id;
    } catch (e) {
      const fallbacks = {
        calm:   'The breath you are taking is enough.',
        focus:  'Begin with the smallest possible move.',
        unwind: 'You are allowed to be only this, right now.'
      };
      advice = fallbacks[this.currentMood?.name] || 'Be still a moment.';
      source = 'a quiet thought';
    }

    textEl.textContent = advice;
    sourceEl.textContent = source;

    gsap.fromTo('.quote',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out' });
  }
}


/* ============================================================
   Atmosphere — drifting particle canvas behind everything.
   Uses requestAnimationFrame for a smooth animation loop.
   ============================================================ */
class Atmosphere {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.palette = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    this._init();
    window.addEventListener('resize', () => this.resize());
    this._loop();
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _init() {
    const count = 65;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 0.4 + Math.random() * 1.6,                // radius
        vx: (Math.random() - 0.5) * 0.18,            // velocity x
        vy: (Math.random() - 0.5) * 0.18,            // velocity y
        a: 0.1 + Math.random() * 0.4                 // alpha
      });
    }
  }

  setPalette(palette) { this.palette = palette; }

  _loop() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    const color = this.palette ? this.palette.c3 : '#f4ede1';

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      // wrap around screen edges
      if (p.x < -10) p.x = this.w + 10;
      if (p.x > this.w + 10) p.x = -10;
      if (p.y < -10) p.y = this.h + 10;
      if (p.y > this.h + 10) p.y = -10;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = p.a;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
    requestAnimationFrame(() => this._loop());
  }
}


/* ============================================================
   Bootstrap — wire everything up once the DOM is ready.
   ============================================================ */
window.atmosphere = new Atmosphere(document.getElementById('atmosphere'));

const controller = new MoodController();

controller.register(new Mood({
  name: 'calm', label: 'Calm',
  palette: { c1: '#4a7fb8', c2: '#2a4a6e', c3: '#87b4d9' },
  audioElement: document.getElementById('audio-calm')
}));

controller.register(new Mood({
  name: 'focus', label: 'Focus',
  palette: { c1: '#c89456', c2: '#6b4a2a', c3: '#e8b878' },
  audioElement: document.getElementById('audio-focus')
}));

controller.register(new Mood({
  name: 'unwind', label: 'Unwind',
  palette: { c1: '#a674a8', c2: '#5a3a6a', c3: '#d4a8d6' },
  audioElement: document.getElementById('audio-unwind')
}));

document.querySelectorAll('.orb').forEach(btn => {
  btn.addEventListener('click', () => controller.setMood(btn.dataset.mood));
});

document.querySelectorAll('.switch-dot').forEach(dot => {
  dot.addEventListener('click', () => controller.setMood(dot.dataset.mood));
});

document.getElementById('release').addEventListener('click', () => {
  controller.transitionToSelection();
});
document.getElementById('newQuote').addEventListener('click', () => {
  controller.refreshAdvice();
});
document.getElementById('vol').addEventListener('input', (e) => {
  controller.setVolume(e.target.value / 100);
});

// Header clock 
function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = hh + ':' + mm;
}
tickClock();
setInterval(tickClock, 30000);

// First-load entrance animation.
gsap.from('.header > *, .selection > *, .footer > div:first-child', {
  opacity: 0,
  y: 14,
  duration: 1.1,
  stagger: 0.1,
  ease: 'power3.out',
  delay: 0.2
});
