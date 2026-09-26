const $ = id => document.getElementById(id);
const node = (tag, className = '', content = '') => { const el = document.createElement(tag); if (className) el.className = className; if (content) el.textContent = content; return el; };
const button = (label, action, className = '') => { const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', action); return el; };
const clockTime = ms => { const total = Math.round(ms / 1000); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
const megabytes = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const pollMs = 2000, driftSeconds = 1.5;

// Where a synced track should be, in seconds, or null once a non-looping track has finished.
export function playbackTarget(state, serverNow, durationSeconds) {
  if (state.status !== 'playing' || state.started_at_ms == null) return null;
  let elapsed = Math.max(0, (serverNow - state.started_at_ms) / 1000);
  if (durationSeconds > 0) {
    if (state.loop) elapsed %= durationSeconds;
    else if (elapsed >= durationSeconds - 0.25) return null;
  }
  return elapsed;
}

export function initJukeboxUI(request, profile) {
  const audio = new Audio(); audio.preload = 'auto';
  let data = null, timer = null, clock = 0, hasClock = false, blocked = false, revision = null, signature = '';
  const settingsKey = () => `jukebox-audio:${profile()?.id}`;
  let settings = { muted: false, volume: 0.7 };
  const isGM = () => profile()?.role === 'gm';

  function loadSettings() {
    try { settings = { ...settings, ...JSON.parse(localStorage.getItem(settingsKey()) || '{}') }; } catch { /* keep defaults */ }
    settings.volume = Math.min(1, Math.max(0, Number(settings.volume) || 0));
    audio.muted = Boolean(settings.muted); audio.volume = settings.volume;
    $('soundMute').checked = audio.muted; $('soundVolume').value = String(Math.round(settings.volume * 100));
  }
  function saveSettings() { localStorage.setItem(settingsKey(), JSON.stringify(settings)); }

  // ---------- Playback shared by every signed-in profile ----------
  function apply() {
    const state = data?.state;
    if (!state || state.status !== 'playing' || !state.url) {
      audio.pause();
      if ((!state || state.status === 'stopped' || !state.url) && audio.getAttribute('src')) { audio.removeAttribute('src'); audio.load(); }
      blocked = false; updateSoundButton(); return;
    }
    if (audio.getAttribute('src') !== state.url) audio.src = state.url;
    audio.loop = state.loop;
    const duration = Number.isFinite(audio.duration) ? audio.duration : (state.duration_ms || 0) / 1000;
    const target = playbackTarget(state, Date.now() + clock, duration);
    if (target === null) { audio.pause(); updateSoundButton(); return; }
    if (audio.readyState >= 1 && (revision !== state.revision || Math.abs(audio.currentTime - target) > driftSeconds)) audio.currentTime = target;
    if (audio.readyState >= 1) revision = state.revision;
    if (audio.paused) {
      audio.play().then(() => { blocked = false; updateSoundButton(); }).catch(cause => {
        if (cause.name === 'NotAllowedError') { blocked = true; updateSoundButton(); }
      });
    }
    updateSoundButton();
  }
  audio.addEventListener('loadedmetadata', apply);

  async function poll() {
    if (!profile()) return;
    const requestingProfile = profile().id;
    try {
      const sent = Date.now();
      const latest = await request('/api/jukebox');
      const received = Date.now();
      if (profile()?.id !== requestingProfile) return;
      // Estimate the server clock from the request midpoint, smoothing out network jitter.
      if (received - sent < 1500) { const sample = latest.now - (sent + received) / 2; clock = hasClock ? clock * 0.7 + sample * 0.3 : sample; hasClock = true; }
      receive(latest);
    } catch (cause) { if (isGM()) message(cause.message); }
  }
  function receive(latest) {
    data = latest;
    apply();
    if (isGM()) renderPanel();
  }

  // ---------- Sound control (all profiles) ----------
  function updateSoundButton() {
    const control = $('soundButton');
    const playing = data?.state?.status === 'playing' && data?.state?.url;
    control.classList.toggle('attention', Boolean(playing && blocked && !audio.muted));
    control.textContent = playing && blocked && !audio.muted ? '♪ Enable sound' : audio.muted ? '♪ Sound off' : '♪ Sound on';
    control.setAttribute('aria-label', playing && blocked && !audio.muted ? 'Music is playing. Enable sound' : 'Music sound settings');
  }
  // Browsers only start audio after a user gesture; retry on the next one.
  const unlock = () => { if (blocked) apply(); };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  $('soundButton').addEventListener('click', () => {
    const menu = $('soundMenu'); menu.hidden = !menu.hidden;
    $('soundButton').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.sound-wrap')) { $('soundMenu').hidden = true; $('soundButton').setAttribute('aria-expanded', 'false'); }
  });
  $('soundMute').addEventListener('change', () => { settings.muted = $('soundMute').checked; audio.muted = settings.muted; saveSettings(); apply(); });
  $('soundVolume').addEventListener('input', () => { settings.volume = Number($('soundVolume').value) / 100; audio.volume = settings.volume; saveSettings(); });

  // ---------- GM Music tab ----------
  const message = text => { $('jukeboxMessage').textContent = text || ''; };
  async function act(values, method = 'POST', path = '/api/jukebox') {
    try {
      const options = method === 'DELETE' ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) };
      receive(await request(path, options)); message('');
    } catch (cause) { message(cause.message); }
  }

  function renderPanel() {
    if (!data?.tracks) return;
    const nextSignature = JSON.stringify([data.state, data.tracks, data.storageConfigured]);
    if (nextSignature === signature) return;
    signature = nextSignature;
    $('jukeboxStorageNote').hidden = data.storageConfigured;
    $('jukeboxUploadButton').disabled = !data.storageConfigured;
    const { state, tracks } = data;
    const current = tracks.find(track => track.id === state.track_id);

    const now = $('jukeboxNowPlaying'); now.replaceChildren();
    const label = node('div', 'jukebox-now-title', current && state.status !== 'stopped' ? current.title : 'Nothing playing');
    const statusText = state.status === 'playing' ? 'Playing for everyone' : state.status === 'paused' ? 'Paused' : 'Stopped';
    now.append(label, node('div', 'jukebox-now-status', current && state.status !== 'stopped' ? statusText : 'Choose a track below to play it for the table.'));
    const controls = node('div', 'jukebox-controls');
    if (current && state.status === 'playing') controls.append(button('Pause', () => act({ action: 'pause' })));
    if (current && state.status === 'paused') controls.append(button('Resume', () => act({ action: 'resume' }), 'primary-button'));
    if (current && state.status !== 'stopped') controls.append(button('Stop', () => act({ action: 'stop' })));
    const loop = node('input'); loop.type = 'checkbox'; loop.checked = state.loop;
    loop.addEventListener('change', () => act({ action: 'loop', loop: loop.checked }));
    const loopLabel = node('label', 'jukebox-loop'); loopLabel.append(loop, document.createTextNode('Loop track'));
    controls.append(loopLabel);
    now.append(controls);

    $('jukeboxUsage').textContent = `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} · ${megabytes(data.usageBytes)} of 1 GB`;
    const list = $('jukeboxTracks'); list.replaceChildren();
    if (!tracks.length) list.append(node('p', 'field-hint', 'No tracks yet. Upload an MP3 above.'));
    for (const track of tracks) {
      const active = track.id === state.track_id && state.status !== 'stopped';
      const row = node('div', 'jukebox-track' + (active ? ' active' : ''));
      const info = node('div', 'jukebox-track-info');
      info.append(node('span', 'jukebox-track-title', track.title), node('small', '', [active ? (state.status === 'playing' ? '▶ Playing' : 'Paused') : null, track.duration_ms ? clockTime(track.duration_ms) : null, megabytes(track.size_bytes)].filter(Boolean).join(' · ')));
      const play = button(active && state.status === 'playing' ? 'Restart' : 'Play', () => act({ action: 'play', trackId: track.id }), active ? '' : 'primary-button');
      play.setAttribute('aria-label', `${play.textContent} ${track.title} for everyone`);
      const remove = button('Delete', () => {
        if (!confirm(`Delete "${track.title}"? This permanently removes the uploaded file.`)) return;
        act(null, 'DELETE', `/api/jukebox?id=${encodeURIComponent(track.id)}`);
      }, 'jukebox-delete');
      remove.setAttribute('aria-label', `Delete ${track.title}`);
      row.append(info, play, remove); list.append(row);
    }
  }

  function readDuration(file) {
    return new Promise(resolve => {
      const probe = new Audio(); const url = URL.createObjectURL(file);
      const finish = value => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(value); };
      const timeout = setTimeout(() => finish(null), 8000);
      probe.addEventListener('loadedmetadata', () => finish(Number.isFinite(probe.duration) ? Math.round(probe.duration * 1000) : null), { once: true });
      probe.addEventListener('error', () => finish(null), { once: true });
      probe.preload = 'metadata'; probe.src = url;
    });
  }

  $('jukeboxFile').addEventListener('change', () => {
    const file = $('jukeboxFile').files[0];
    if (file && !$('jukeboxTitle').value.trim()) $('jukeboxTitle').value = file.name.replace(/\.mp3$/i, '').slice(0, 120);
  });
  $('jukeboxUploadForm').addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('jukeboxFile').files[0], title = $('jukeboxTitle').value.trim();
    const limit = data?.maxTrackBytes || 15 * 1024 * 1024;
    if (!file) return message('Choose an MP3 file to upload.');
    if (!(file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name))) return message('Only MP3 files can be uploaded.');
    if (file.size > limit) return message(`Tracks must be ${megabytes(limit)} or smaller.`);
    if (!title) return message('Give the track a title.');
    const submit = $('jukeboxUploadButton'); submit.disabled = true;
    try {
      message('Preparing upload…');
      const durationMs = await readDuration(file);
      const { pathname, clientToken } = await request('/api/jukebox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload-token', size: file.size }) });
      const { put } = await import('./vendor/blob-client.js');
      await put(pathname, file, {
        access: 'public', token: clientToken, contentType: 'audio/mpeg', multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: progress => message(`Uploading… ${Math.round(progress.percentage)}%`)
      });
      message('Saving track…');
      receive(await request('/api/jukebox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', pathname, title, durationMs }) }));
      $('jukeboxUploadForm').reset();
      message(`Added "${title}".`);
    } catch (cause) { message(`Upload failed: ${cause.message}`); }
    finally { submit.disabled = !data?.storageConfigured; }
  });

  return {
    start() {
      loadSettings(); data = null; signature = ''; revision = null; hasClock = false;
      $('soundControl').hidden = false; updateSoundButton();
      clearInterval(timer); poll(); timer = setInterval(poll, pollMs);
    },
    stop() {
      clearInterval(timer); timer = null; data = null; blocked = false;
      audio.pause(); audio.removeAttribute('src'); audio.load();
      $('soundControl').hidden = true; $('soundMenu').hidden = true;
      message(''); signature = '';
    }
  };
}
