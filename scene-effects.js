// Presentation-only scene effects: the ink-bloom transition between locations and drifting dust.
// Both stand down when the page is not in motion mode (reduced motion).
const motion = () => Boolean(document.getElementById('app')?.classList.contains('motion'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function grow(element, x, y, from, to, duration) {
  element.classList.add('scene-bloom');
  element.style.transition = 'none';
  element.style.setProperty('--bloom-x', `${x}px`);
  element.style.setProperty('--bloom-y', `${y}px`);
  element.style.setProperty('--bloom-size', `${from}px`);
  element.getBoundingClientRect();
  element.style.transition = `--bloom-size ${duration}ms cubic-bezier(.35,.05,.2,1)`;
  element.style.setProperty('--bloom-size', `${to}px`);
  return wait(duration + 40);
}

function clearBloom(element) {
  element.classList.remove('scene-bloom');
  for (const name of ['transition', '--bloom-x', '--bloom-y', '--bloom-size']) element.style.removeProperty(name);
}

// Location views are replaced in place, so the outgoing scene is moved into a ghost layer that the
// incoming scene blooms over (or that shrinks away when returning to the star chart).
export function createSceneTransition(view) {
  const host = view.parentElement;
  let ghost = null, ink = null, run = 0;

  function finish() {
    run++;
    ghost?.remove(); ink?.remove(); ghost = ink = null;
    clearBloom(view);
  }

  return {
    // Call before the view's content changes to a different location.
    prepare() {
      finish();
      if (!motion() || view.hidden || !view.childElementCount) return;
      ghost = document.createElement('div');
      ghost.className = `${view.className} scene-ghost`;
      ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
      const scroll = [view.scrollLeft, view.scrollTop];
      ghost.append(...view.childNodes);
      view.after(ghost);
      [ghost.scrollLeft, ghost.scrollTop] = scroll;
    },
    // Call after the new location has rendered; origin is a viewport point such as the clicked marker.
    async play(origin) {
      if (!motion()) { finish(); return; }
      const token = ++run;
      const bounds = host.getBoundingClientRect();
      const diagonal = Math.hypot(bounds.width, bounds.height);
      const x = (origin?.x ?? bounds.left + bounds.width / 2) - bounds.left;
      const y = (origin?.y ?? bounds.top + bounds.height / 2) - bounds.top;
      if (view.hidden) {
        if (!ghost) return;
        ghost.classList.add('leaving');
        await grow(ghost, bounds.width / 2, bounds.height / 2, diagonal * 2.9, 0, 850);
        if (token === run) finish();
        return;
      }
      ink = document.createElement('div'); ink.className = 'scene-ink'; ink.setAttribute('aria-hidden', 'true');
      view.before(ink);
      const inkDone = grow(ink, x, y, 0, diagonal * 3.2, 950);
      view.style.setProperty('--bloom-size', '0px');
      view.classList.add('scene-bloom');
      view.firstElementChild?.animate([{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 1400, easing: 'cubic-bezier(.2,.6,.2,1)' });
      await wait(170);
      if (token !== run) return;
      await grow(view, x, y, 0, diagonal * 2.9, 1150);
      if (token !== run) return;
      clearBloom(view); ghost?.remove(); ghost = null;
      ink.classList.add('fading');
      await inkDone; await wait(600);
      if (token === run) finish();
    },
    finish
  };
}

// Warm motes of light drifting through Hub and Vista scenes.
export function createSceneDust(view) {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-dust'; canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
  view.after(canvas);
  const context = canvas.getContext('2d');
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
  const spriteContext = sprite.getContext('2d'), glow = spriteContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,226,170,1)'); glow.addColorStop(.3, 'rgba(255,200,130,.45)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
  spriteContext.fillStyle = glow; spriteContext.fillRect(0, 0, 32, 32);
  let enabled = false, frame = 0, last = 0, width = 0, height = 0, motes = [];

  function size() {
    const bounds = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 1.5);
    width = bounds.width; height = bounds.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(48, Math.round(width * height / 26000));
    motes = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, r: 1.5 + Math.random() ** 2 * 5, vx: (Math.random() - .5) * 6, vy: -3 - Math.random() * 7, phase: Math.random() * 6.28, alpha: .12 + Math.random() * .42 }));
  }
  function draw(time) {
    const step = Math.min(.05, (time - (last || time)) / 1000); last = time;
    context.clearRect(0, 0, width, height); context.globalCompositeOperation = 'lighter';
    for (const mote of motes) {
      mote.phase += step * .8; mote.x += (mote.vx + Math.sin(mote.phase) * 4) * step; mote.y += mote.vy * step;
      if (mote.y < -10) { mote.y = height + 10; mote.x = Math.random() * width; }
      if (mote.x < -10) mote.x = width + 10; else if (mote.x > width + 10) mote.x = -10;
      context.globalAlpha = mote.alpha * (.65 + .35 * Math.sin(mote.phase * 1.7));
      const diameter = mote.r * 4; context.drawImage(sprite, mote.x - diameter / 2, mote.y - diameter / 2, diameter, diameter);
    }
    frame = requestAnimationFrame(draw);
  }
  function update() {
    const running = enabled && motion() && !document.hidden;
    canvas.hidden = !running;
    if (running && !frame) { size(); last = 0; frame = requestAnimationFrame(draw); }
    if (!running && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  document.addEventListener('visibilitychange', update);
  new ResizeObserver(() => { if (frame) size(); }).observe(canvas);
  return {
    // Dust drifts through Hubs and Vistas; tactical Explorable grids stay clear.
    set(kind) { enabled = kind === 'settlement' || kind === 'diorama'; update(); }
  };
}
