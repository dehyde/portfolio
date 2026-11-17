(() => {
  function formatTime(seconds) {
    const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  document.querySelectorAll('.video-player').forEach(player => {
    const video = player.querySelector('video');
    const caption = player.closest('figure').querySelector('figcaption').textContent;
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    controls.innerHTML = '<button type="button" class="video-toggle">Play</button><span class="video-time"></span><button type="button" class="video-expand">Full screen</button>';
    const toggle = controls.querySelector('.video-toggle');
    const time = controls.querySelector('.video-time');
    const expand = controls.querySelector('.video-expand');
    const seek = document.createElement('input');
    seek.className = 'video-seek';
    seek.type = 'range';
    seek.min = '0';
    seek.max = '100';
    seek.step = '.1';
    seek.value = '0';
    seek.disabled = true;
    seek.setAttribute('aria-label', `Playback position. ${caption}`);
    player.setAttribute('role', 'group');
    player.setAttribute('aria-label', caption);

    const status = document.createElement('div');
    status.className = 'video-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = '<span class="video-spinner" aria-hidden="true"></span><strong class="video-status-label"></strong><p class="video-status-message"></p><button type="button" class="video-retry">Retry recording</button>';
    const statusLabel = status.querySelector('.video-status-label');
    const statusMessage = status.querySelector('.video-status-message');
    const retryButton = status.querySelector('.video-retry');
    let state = '';
    let hasFrame = false;
    let intendedPlayback = false;
    let automaticRetryUsed = false;
    let retrying = false;
    let resumeAfterLoad = false;
    let recoveryTime = 0;
    let watchdog = null;
    let frameRequest = null;

    function isVisible() {
      const bounds = player.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < innerHeight;
    }

    function clearWatchdog() {
      if (watchdog !== null) clearTimeout(watchdog);
      watchdog = null;
    }

    function cancelFrameRequest() {
      if (frameRequest !== null) video.cancelVideoFrameCallback(frameRequest);
      frameRequest = null;
    }

    function setState(next) {
      state = next;
      player.dataset.videoState = next;
      player.setAttribute('aria-busy', String(next === 'loading'));
      player.classList.toggle('is-loading', next === 'loading');
      status.hidden = next === 'ready';
      retryButton.hidden = next !== 'error';
      toggle.disabled = false;
      if (next === 'error') {
        statusLabel.textContent = 'Recording couldn’t load';
        statusMessage.textContent = 'Try again. If it still fails, check your connection or refresh this page.';
      } else if (next === 'idle') {
        statusLabel.textContent = 'Recording paused';
        statusMessage.textContent = 'Press Play to continue.';
      } else if (next === 'loading') {
        statusLabel.textContent = retrying ? 'Retrying recording…' : hasFrame ? 'Buffering recording…' : 'Loading recording…';
        statusMessage.textContent = retrying ? 'Reconnecting to the recording.' : '';
      }
    }

    function frameReady() {
      if (video.error || video.seeking || video.readyState < 2 || !video.videoWidth || state === 'error') return;
      hasFrame = true;
      retrying = false;
      clearWatchdog();
      setState('ready');
    }

    function requestFrame() {
      if (frameRequest !== null) return;
      if (typeof video.requestVideoFrameCallback !== 'function') {
        frameReady();
        return;
      }
      frameRequest = video.requestVideoFrameCallback(() => {
        frameRequest = null;
        frameReady();
        if (state === 'loading') requestFrame();
      });
    }

    function armWatchdog() {
      if (watchdog !== null || !isVisible() || (!intendedPlayback && !resumeAfterLoad)) return;
      watchdog = setTimeout(() => {
        watchdog = null;
        failPlayback();
      }, 12000);
    }

    function beginLoading() {
      setState('loading');
      requestFrame();
      if (state === 'loading') armWatchdog();
    }

    function retry(manual = false) {
      clearWatchdog();
      cancelFrameRequest();
      if (manual) automaticRetryUsed = false;
      resumeAfterLoad = manual || intendedPlayback || !video.paused;
      recoveryTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      hasFrame = false;
      retrying = true;
      setState('loading');
      video.load();
      armWatchdog();
    }

    function failPlayback() {
      if (state === 'error') return;
      clearWatchdog();
      cancelFrameRequest();
      if (!automaticRetryUsed && isVisible()) {
        automaticRetryUsed = true;
        retry();
        return;
      }
      resumeAfterLoad = false;
      retrying = false;
      video.pause();
      setState('error');
      update();
    }

    function playRejected(error) {
      if (state === 'error' || (error.name === 'AbortError' && retrying)) return;
      if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
        intendedPlayback = false;
        clearWatchdog();
        cancelFrameRequest();
        setState(hasFrame ? 'ready' : 'idle');
        update();
        return;
      }
      failPlayback();
    }

    async function playRecording() {
      intendedPlayback = true;
      beginLoading();
      try { await video.play(); }
      catch (error) { playRejected(error); }
    }

    function update() {
      const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
      const percent = hasDuration ? video.currentTime / video.duration * 100 : 0;
      seek.disabled = !hasDuration;
      seek.value = String(percent);
      seek.style.setProperty('--played', `${percent}%`);
      seek.setAttribute('aria-valuetext', `${formatTime(video.currentTime)} of ${formatTime(video.duration)}`);
      time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      toggle.textContent = state === 'error' ? 'Retry' : video.paused ? 'Play' : 'Pause';
      toggle.setAttribute('aria-label', `${state === 'error' ? 'Retry' : video.paused ? 'Play' : 'Pause'} recording`);
      player.classList.toggle('is-paused', video.paused);
    }

    toggle.addEventListener('click', () => {
      if (state === 'error') retry(true);
      else if (!video.paused) video.pause();
      else void playRecording();
    });
    retryButton.addEventListener('click', () => retry(true));
    seek.addEventListener('input', () => {
      if (!Number.isFinite(video.duration)) return;
      video.currentTime = video.duration * Number(seek.value) / 100;
      update();
    });
    expand.hidden = !document.fullscreenEnabled || !player.requestFullscreen;
    expand.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === player) await document.exitFullscreen();
        else await player.requestFullscreen();
      } catch {
        expand.title = 'Full screen is unavailable in this browser.';
      }
    });
    document.addEventListener('fullscreenchange', () => {
      expand.textContent = document.fullscreenElement === player ? 'Exit full screen' : 'Full screen';
    });
    ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended'].forEach(event => video.addEventListener(event, update));
    video.addEventListener('play', () => { intendedPlayback = true; beginLoading(); });
    video.addEventListener('playing', requestFrame);
    video.addEventListener('pause', () => {
      if (resumeAfterLoad) return;
      intendedPlayback = false;
      clearWatchdog();
      if (state !== 'error') setState(hasFrame ? 'ready' : 'idle');
    });
    video.addEventListener('loadstart', () => { hasFrame = false; beginLoading(); });
    ['waiting', 'stalled', 'seeking'].forEach(event => video.addEventListener(event, beginLoading));
    ['loadeddata', 'canplay', 'seeked'].forEach(event => video.addEventListener(event, requestFrame));
    video.addEventListener('timeupdate', () => {
      if (typeof video.requestVideoFrameCallback !== 'function' && state === 'loading') frameReady();
    });
    video.addEventListener('loadedmetadata', () => {
      if (!retrying) return;
      if (recoveryTime > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(recoveryTime, Math.max(0, video.duration - .1));
      }
      const resume = resumeAfterLoad;
      resumeAfterLoad = false;
      if (resume && isVisible()) void playRecording();
      else clearWatchdog();
    });
    video.addEventListener('error', failPlayback);
    video.querySelectorAll('source').forEach(source => source.addEventListener('error', failPlayback));
    video.addEventListener('parakit-playback-error', event => playRejected(event.detail));
    player.append(status, controls, seek);
    if (video.error) failPlayback();
    else if (video.readyState >= 2 && video.videoWidth) frameReady();
    else beginLoading();
    video.controls = false;
    update();
  });
})();
