// The pinned chrome OUTSIDE the shell: the mute, the gear, the settings card,
// and the first-gesture audio start. All of it has to be there in all three
// modes and on the title screen, and it must survive every replaceChildren
// on #app — which is why it hangs off document.body and not off the shell.

import type { GameState } from './state/types';
import type { UiState } from './uistate';
import { button, el } from './render/svg';
import { renderMuteToggle } from './render/ui';
import { renderSettings, renderWall } from './render/cards';
import { motionPref, setMotionPref } from './motion';
import { buzz, hapticPref, hapticsSupported, setHapticPref } from './haptics';
import { forgetTeaching, taught } from './taught';
import { fallen } from './memorial';
import { ambienceFor, isMuted, play, setAmbience, toggleMute, wake } from './audio';

/**
 * The mute lives outside the shell: it has to be there in all three modes and
 * on the title screen, and it must survive replaceChildren on #app.
 */
const muteSlot = el('div', { class: 'mute-slot' });

/**
 * The settings, pinned beside the mute and rendered outside the mode chrome
 * for the same reason the mute is: they have to be reachable on the title
 * screen and in all three modes, and they must survive every replaceChildren
 * on #app.
 */
const settingsSlot = el('div', { class: 'settings-slot' });
const menuSlot = el('div', { class: 'menu-slot' });

let ui: UiState | null = null;
let current: () => GameState | null = () => null;

function paintMute(): void {
  muteSlot.replaceChildren(
    renderMuteToggle(isMuted(), () => {
      // Toggling is itself a gesture, so it is also a valid moment to start
      // the audio — tapping "sound on" must actually produce sound.
      wake();
      const nowMuted = toggleMute();
      paintMute();
      if (!nowMuted) {
        play('tap');
        const state = current();
        if (state) setAmbience(ambienceFor(state));
      }
    }),
  );
}

function paintGear(): void {
  const gear = button('', () => {
    ui!.settingsOpen = true;
    paintSettingsCard();
  }, { class: 'gear', title: 'Settings', 'aria-label': 'Settings' });
  gear.append(gearGlyph());
  menuSlot.replaceChildren(gear);
}

function gearGlyph(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'gear-glyph');
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', '12');
  ring.setAttribute('cy', '12');
  ring.setAttribute('r', '4');
  svg.append(ring);
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI / 4) * i;
    const spoke = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    spoke.setAttribute('x1', `${12 + Math.cos(angle) * 6.5}`);
    spoke.setAttribute('y1', `${12 + Math.sin(angle) * 6.5}`);
    spoke.setAttribute('x2', `${12 + Math.cos(angle) * 9.5}`);
    spoke.setAttribute('y2', `${12 + Math.sin(angle) * 9.5}`);
    svg.append(spoke);
  }
  return svg;
}

function paintSettingsCard(): void {
  if (!ui!.settingsOpen) {
    settingsSlot.replaceChildren();
    return;
  }
  const state = current();
  settingsSlot.replaceChildren(
    renderSettings({
      muted: isMuted(),
      onToggleSound: () => {
        wake();
        const nowMuted = toggleMute();
        paintMute();
        if (!nowMuted) {
          play('tap');
          const now = current();
          if (now) setAmbience(ambienceFor(now));
        }
        paintSettingsCard();
      },
      motionStill: motionPref() === 'still',
      // Offered only where it can do something. Every iPhone lands here
      // with `false` and simply does not see the row — a switch wired to
      // nothing is worse than no switch.
      ...(hapticsSupported() ? { rumbleOn: hapticPref() === 'on' } : {}),
      onToggleRumble: () => {
        setHapticPref(hapticPref() === 'on' ? 'off' : 'on');
        if (hapticPref() === 'on') buzz(['strike']);
        paintSettingsCard();
      },
      ...(state?.hardship ? { hardship: state.hardship } : {}),
      onToggleMotion: () => {
        setMotionPref(motionPref() === 'still' ? 'system' : 'still');
        paintSettingsCard();
      },
      ...(state ? { seed: state.seed } : {}),
      ...(taught().length > 0
        ? {
            onRelearn: () => {
              forgetTeaching();
              paintSettingsCard();
            },
          }
        : {}),
      ...(fallen().length > 0
        ? {
            onWall: () => {
              // The memorial opens IN the settings slot and comes back to
              // the settings, so it is reachable mid-run for the first time.
              settingsSlot.replaceChildren(renderWall(fallen(), paintSettingsCard));
            },
          }
        : {}),
      onClose: () => {
        ui!.settingsOpen = false;
        paintSettingsCard();
      },
    }),
  );
}

/**
 * Every mobile browser refuses to start an AudioContext outside a real user
 * gesture, so the game stays silent until the player touches it — which is
 * also the polite default. One listener, removed once it has done its job.
 */
function armAudio(): void {
  const start = (): void => {
    wake();
    const state = current();
    if (state) setAmbience(ambienceFor(state));
    window.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', start);
  };
  window.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start);
}

/** Hangs the pinned chrome off the body and arms the audio. Once, at boot. */
export function installChrome(uiState: UiState, currentState: () => GameState | null): void {
  ui = uiState;
  current = currentState;
  paintMute();
  document.body.append(muteSlot, menuSlot, settingsSlot);
  paintGear();
  armAudio();
}
