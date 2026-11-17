// YouTube IFrame Player wrapper. The player must stay visible (YouTube API rules), min 200x200.
let apiReady = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiReady ||= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiReady = null; reject(new Error('YouTube API failed to load')); };
    document.head.append(s);
  });
  return apiReady;
}

const ERRORS = { 2: 'That link is not a valid video', 5: 'This video cannot play here', 100: 'Video not found or private', 101: 'This video cannot be embedded, try a lyric or audio upload of the song', 150: 'This video cannot be embedded, try a lyric or audio upload of the song' };

// el: container element. Returns a promise of {cue, play, pause, seek, time, duration, playing, onEnd, onError, destroy}
export async function createYouTube(el) {
  await loadApi();
  const box = document.createElement('div');
  el.append(box);
  const handlers = { end: () => {}, error: () => {}, state: () => {} };
  let cued = null;
  const player = await new Promise(resolve => {
    const p = new YT.Player(box, {
      width: 200, height: 200,
      playerVars: { playsinline: 1, rel: 0, disablekb: 1, modestbranding: 1 },
      events: {
        onReady: () => resolve(p),
        onStateChange: e => {
          if (e.data === YT.PlayerState.ENDED) handlers.end();
          if (e.data === YT.PlayerState.CUED || e.data === YT.PlayerState.PLAYING) cued?.();
          handlers.state(e.data);
        },
        onError: e => handlers.error(ERRORS[e.data] ?? 'Video error'),
      },
    });
  });
  return {
    // resolves once the video is loaded (or after 4 s), so duration() is known when YouTube allows
    cue: vid => new Promise(resolve => {
      const done = () => { cued = null; clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, 4000);
      cued = done;
      player.cueVideoById(vid);
    }),
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    stop: () => player.stopVideo(),
    seek: t => player.seekTo(t, true),
    time: () => player.getCurrentTime?.() ?? 0,
    duration: () => player.getDuration?.() ?? 0,
    playing: () => player.getPlayerState?.() === YT.PlayerState.PLAYING,
    onEnd: fn => { handlers.end = fn; },
    onError: fn => { handlers.error = fn; },
    onState: fn => { handlers.state = fn; },
    destroy: () => { player.destroy(); el.replaceChildren(); },
  };
}
