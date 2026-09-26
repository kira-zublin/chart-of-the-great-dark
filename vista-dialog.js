// Visual-novel dialog for Vistas: echoes chat lines from the people in the scene with a portrait, typing them out
// letter by letter. Chat feeds it messages and the world view tells it which Vista is open and who stands there.
const $ = id => document.getElementById(id);
const node = (tag, className = '', content = '') => { const el = document.createElement(tag); if (className) el.className = className; if (content) el.textContent = content; return el; };
const anonymous = 'assets/characters/anonymous-explorer.png';
const charsPerSecond = 40;
const historyLimit = 100;

// Lines starting with //, (( or ooc: are out of character and stay in the chat log only.
export const outOfCharacter = text => /^\s*(\/\/|\(\(|ooc:)/i.test(text);

// The dialog form of a chat message, or null for rolls, blank lines and out-of-character talk.
export function dialogLine(message) {
  if (message.kind !== 'text' || !message.body?.trim() || outOfCharacter(message.body)) return null;
  const narrator = message.from_gm && !message.character_id;
  return {
    id: Number(message.id), narrator, text: message.body.trim(),
    speaker: narrator ? message.player_name : message.character_name || message.player_name,
    portrait: narrator ? null : message.has_portrait && message.character_id ? `/api/image?id=${encodeURIComponent(message.character_id)}&slot=portrait` : anonymous
  };
}

// The GM always speaks in the scene (as narrator or an NPC); players only through characters standing in this Vista.
export const heardIn = (message, speakers) => Boolean(message.from_gm || (message.character_id && speakers.has(message.character_id)));

// How long a finished line stays before the next queued one starts, so it can be read.
export const readingPause = text => Math.min(4000, 1200 + text.length * 25);

export function initVistaDialog(profile) {
  let history = [], queue = [], scene = null, shown = null, typing = null, pause = null;
  const storageKey = () => `vista-dialog-open:${profile()?.id}`;
  const readOpen = () => { try { return localStorage.getItem(storageKey()) !== 'false'; } catch { return true; } };
  let open = true;

  const box = node('section', 'vista-dialog'); box.hidden = true; box.setAttribute('aria-label', 'Scene dialog');
  const portrait = node('img', 'vista-dialog-portrait'); portrait.alt = '';
  portrait.addEventListener('error', () => { if (!portrait.src.endsWith(anonymous)) portrait.src = anonymous; });
  const body = node('div', 'vista-dialog-body');
  const name = node('div', 'vista-dialog-name');
  const text = node('div', 'vista-dialog-text');
  const announcer = node('div', 'visually-hidden'); announcer.setAttribute('aria-live', 'polite');
  const hide = node('button', 'vista-dialog-hide', '×'); hide.type = 'button'; hide.setAttribute('aria-label', 'Hide dialog window'); hide.title = 'Hide dialog window';
  body.append(name, text);
  box.append(portrait, body, hide, announcer);
  const show = node('button', 'vista-dialog-show', 'Show dialog'); show.type = 'button'; show.hidden = true;
  $('mapStage').append(box, show);

  const motion = () => Boolean($('app')?.classList.contains('motion'));
  const inScene = message => scene && heardIn(message, scene.speakers);
  const latestLine = () => { for (let i = history.length - 1; i >= 0; i--) { const line = inScene(history[i]) && dialogLine(history[i]); if (line) return line; } return null; };

  function stopTyping() { clearInterval(typing); typing = null; clearTimeout(pause); pause = null; }
  function layout() {
    box.hidden = !scene || !open || !shown;
    show.hidden = !scene || open;
  }
  // Writes a line into the box: all at once, or letter by letter and then on to the next queued line.
  function display(line, animate) {
    stopTyping();
    shown = line; layout();
    if (!line) return;
    box.classList.toggle('narrator', line.narrator);
    portrait.hidden = line.narrator;
    if (!line.narrator && portrait.getAttribute('src') !== line.portrait) portrait.src = line.portrait;
    name.textContent = line.speaker;
    announcer.textContent = `${line.speaker}: ${line.text}`;
    const letters = [...line.text];
    if (!animate || !motion() || box.hidden) { text.textContent = line.text; text.scrollTop = text.scrollHeight; afterLine(); return; }
    let count = 0; text.textContent = '';
    typing = setInterval(() => {
      count = Math.min(letters.length, count + 1);
      text.textContent = letters.slice(0, count).join('');
      text.scrollTop = text.scrollHeight;
      if (count === letters.length) { clearInterval(typing); typing = null; afterLine(); }
    }, 1000 / charsPerSecond);
  }
  function afterLine() {
    if (!queue.length) return;
    pause = setTimeout(() => { pause = null; next(); }, readingPause(shown?.text || ''));
  }
  function next() { const line = queue.shift(); if (line) display(line, true); }
  // A click finishes the line being typed, or moves straight on to the next queued line.
  box.addEventListener('click', event => {
    if (event.target === hide) return;
    if (typing) { stopTyping(); text.textContent = shown.text; text.scrollTop = text.scrollHeight; afterLine(); }
    else if (queue.length) { stopTyping(); next(); }
  });
  function setOpen(value) {
    open = value;
    try { localStorage.setItem(storageKey(), String(open)); } catch { /* remembered for this visit only */ }
    // Reopening shows the newest line in full rather than replaying what was missed.
    queue = []; display(open ? latestLine() : shown, false);
    (open ? hide : show).focus({ preventScroll: true });
  }
  hide.addEventListener('click', () => setOpen(false));
  show.addEventListener('click', () => setOpen(true));

  return {
    // New chat messages. The first batch after sign-in is history: it is remembered but not typed out.
    receive(messages, initial = false) {
      const known = new Set(history.map(item => Number(item.id)));
      const fresh = messages.filter(item => !known.has(Number(item.id)));
      history = [...history, ...fresh].sort((a, b) => a.id - b.id).slice(-historyLimit);
      if (!scene) return;
      if (initial) { if (!shown) display(latestLine(), false); return; }
      const lines = fresh.filter(inScene).map(dialogLine).filter(Boolean);
      if (!lines.length) return;
      if (!open) { shown = lines.at(-1); return; }
      queue.push(...lines);
      if (!typing && !pause) next();
    },
    // The open Vista and the characters standing in it, or null outside a Vista.
    setScene(next) {
      const entering = next?.id !== scene?.id;
      scene = next;
      if (!scene) { stopTyping(); queue = []; shown = null; layout(); return; }
      if (entering) { open = readOpen(); queue = []; display(latestLine(), false); }
      else layout();
    },
    reset() { stopTyping(); history = []; queue = []; scene = null; shown = null; layout(); }
  };
}
