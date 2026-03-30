import { DEFAULT_SCHOOL_KEY, SELECTABLE_SCHOOLS, SITE_CONFIG } from './site-config.js';

const browserFallback = document.getElementById('browser-fallback');
const fallbackMessage = document.getElementById('fallback-message');
const audioToggle = document.getElementById('audio-toggle');
const schoolPromptButton = document.getElementById('school-prompt-btn');
const interactiveControls = [
  document.getElementById('light-btn'),
  schoolPromptButton,
  document.getElementById('reset-btn'),
  audioToggle,
].filter(Boolean);

export const prefersReducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function colorLettersWithColors(text, elId, color1, color2) {
  const el = document.getElementById(elId);
  if (!el) return;

  let html = '';
  let colorIdx = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      html += ' ';
      continue;
    }
    const color = colorIdx % 2 === 0 ? color1 : color2;
    html += `<span style="color:${color}">${text[i]}</span>`;
    colorIdx++;
  }
  el.innerHTML = html;
}

export function setCongratsMessage(text, color1, color2) {
  colorLettersWithColors(text, 'congrats-text', color1, color2);
  requestAnimationFrame(syncCongratsOverlayLayout);
}

export function syncCongratsLogoHeight() {
  const overlay = document.getElementById('congrats-overlay');
  const textBlock = document.getElementById('congrats-text-block');
  const left = document.getElementById('congrats-logo-left');
  const right = document.getElementById('congrats-logo-right');
  if (!overlay || !textBlock || !left || !right) return;

  if (overlay.classList.contains('compact')) {
    left.style.height = '';
    right.style.height = '';
    return;
  }

  const height = `${textBlock.offsetHeight}px`;
  left.style.height = height;
  right.style.height = height;
}

export function syncCongratsOverlayLayout() {
  const overlay = document.getElementById('congrats-overlay');
  const content = document.getElementById('congrats-content');
  if (!overlay || !content) return;

  overlay.style.fontSize = '';
  if (getComputedStyle(overlay).display === 'none') return;

  overlay.classList.remove('compact');
  syncCongratsLogoHeight();

  const maxWidth = Math.max(window.innerWidth - 24, 220);
  if (content.scrollWidth > maxWidth) {
    overlay.classList.add('compact');
  }

  let fontSize = parseFloat(getComputedStyle(overlay).fontSize);
  while (fontSize > 18 && content.scrollWidth > maxWidth) {
    fontSize -= 1;
    overlay.style.fontSize = `${fontSize}px`;
  }

  syncCongratsLogoHeight();
}

export function setStatusMessage(message) {
  void message;
}

// Compatibility shim for browsers holding an older cached cake-experience module.
export function announceStatus() {}

export function showSchoolPicker() {
  if (!schoolPromptButton) return;
  schoolPromptButton.hidden = false;
}

export function hideSchoolPicker() {
  if (schoolPromptButton) schoolPromptButton.hidden = true;
}

export function setAudioToggleState(isPlaying) {
  if (!audioToggle) return;
  audioToggle.innerHTML = isPlaying
    ? '<svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"></rect></svg>'
    : '<svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>';
}

export function showFallback(title, message) {
  const fallbackTitle = document.getElementById('fallback-title');
  if (fallbackTitle && title) fallbackTitle.textContent = title;
  if (fallbackMessage && message) fallbackMessage.textContent = message;
  interactiveControls.forEach((control) => {
    control.disabled = true;
  });
  if (browserFallback) browserFallback.hidden = false;
  setStatusMessage('');
}

export function hideFallback() {
  interactiveControls.forEach((control) => {
    control.disabled = false;
  });
  if (browserFallback) browserFallback.hidden = true;
}

export function bindAppControls(handlers) {
  document.getElementById('light-btn')?.addEventListener('click', () => handlers.onLight?.());
  document.getElementById('reset-btn')?.addEventListener('click', () => handlers.onReset?.());
  audioToggle?.addEventListener('click', () => handlers.onToggleAudio?.());
  document.getElementById('fallback-retry')?.addEventListener('click', () => handlers.onRetry?.());
}

export function initializeSharedUi() {
  const defaultSchool = SELECTABLE_SCHOOLS[DEFAULT_SCHOOL_KEY];
  document.title = SITE_CONFIG.meta.title;
  const recipientName = document.getElementById('tati-text');
  if (recipientName) recipientName.textContent = SITE_CONFIG.event.recipientName;
  const leftLogo = document.getElementById('congrats-logo-left');
  const rightLogo = document.getElementById('congrats-logo-right');
  if (leftLogo) leftLogo.src = defaultSchool.logo;
  if (rightLogo) rightLogo.src = defaultSchool.logo;
  window.addEventListener('resize', syncCongratsOverlayLayout);
  colorLettersWithColors(SITE_CONFIG.event.congratsHeadline, 'congrats-text', defaultSchool.secondaryCSS, defaultSchool.primaryCSS);
  colorLettersWithColors(defaultSchool.goText, 'goblue-text', defaultSchool.secondaryCSS, defaultSchool.primaryCSS);
  setAudioToggleState(true);
}
