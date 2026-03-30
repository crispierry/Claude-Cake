import {
  bindAppControls,
  hideFallback,
  initializeSharedUi,
  setStatusMessage,
  showFallback,
} from './shared-ui.js';

let bootPromise = null;

function supportsWebGl() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch (error) {
    return false;
  }
}

function callWhenReady(fnName, loadingMessage) {
  const fn = window[fnName];
  if (typeof fn === 'function') {
    fn();
    return;
  }
  setStatusMessage(loadingMessage);
}

function bindControls() {
  bindAppControls({
    onLight: () => callWhenReady('startBurn', 'The scene is still loading. Please try again in a moment.'),
    onReset: () => callWhenReady('resetCake', 'The scene is still loading. Please try again in a moment.'),
    onToggleAudio: () => callWhenReady('toggleFightSong', 'Audio controls will be ready once the celebration starts.'),
    onChooseSchool: (key) => {
      const selector = window.selectSchoolByKey;
      if (typeof selector === 'function') {
        selector(key);
        return;
      }
      setStatusMessage('Pick a school after the cake finishes burning.');
    },
    onRetry: () => {
      window.location.reload();
    },
  });
}

async function bootstrapExperience() {
  initializeSharedUi();
  bindControls();

  if (!supportsWebGl()) {
    showFallback(
      'This browser cannot render the 3D cake',
      'Open the site in a recent Safari, Chrome, Firefox, or Edge build with hardware acceleration enabled.'
    );
    return;
  }

  setStatusMessage('Loading the 3D celebration experience...');

  try {
    await import('./cake-experience.js');
    hideFallback();
    setStatusMessage('Drag to rotate. Scroll or pinch to zoom. Press L to light the candle when you are ready.');
  } catch (error) {
    console.error('Failed to start Celebration Cake', error);
    showFallback(
      'The 3D experience failed to start',
      'Reload the page to try again. If the problem persists, use a different browser or device.'
    );
  }
}

if (!bootPromise) {
  bootPromise = bootstrapExperience();
}
