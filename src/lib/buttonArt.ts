/**
 * Default artwork catalog for newly-added elements.
 *
 * Every entry pairs an input command with a bundled default image (served from
 * /buttons, sourced from the official libretro "flat" gamepad pack) so that a
 * new button is immediately visible on the canvas and in exports.
 */
export interface ButtonArt {
  /** desc command written into the cfg (e.g. "a", "up", "menu_toggle") */
  cmd: string;
  /** human-readable name shown in the picker */
  label: string;
  /** file name under /buttons */
  img: string;
  /** default half-extents (normalized, same units as desc w/h) */
  w: number;
  h: number;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const buttonArtUrl = (img: string) => `${BASE}/buttons/${encodeURIComponent(img)}`;

export const BUTTON_ART: ButtonArt[] = [
  // D-pad
  { cmd: 'up', label: 'D-Pad Up', img: 'dpad-up.png', w: 0.05, h: 0.05 },
  { cmd: 'down', label: 'D-Pad Down', img: 'dpad-down.png', w: 0.05, h: 0.05 },
  { cmd: 'left', label: 'D-Pad Left', img: 'dpad-left.png', w: 0.05, h: 0.05 },
  { cmd: 'right', label: 'D-Pad Right', img: 'dpad-right.png', w: 0.05, h: 0.05 },
  // Face
  { cmd: 'a', label: 'Button A', img: 'a.png', w: 0.04, h: 0.04 },
  { cmd: 'b', label: 'Button B', img: 'b.png', w: 0.04, h: 0.04 },
  { cmd: 'x', label: 'Button X', img: 'x.png', w: 0.04, h: 0.04 },
  { cmd: 'y', label: 'Button Y', img: 'y.png', w: 0.04, h: 0.04 },
  // Start / Select
  { cmd: 'start', label: 'Start', img: 'start.png', w: 0.05, h: 0.028 },
  { cmd: 'select', label: 'Select', img: 'select.png', w: 0.05, h: 0.028 },
  // Shoulders
  { cmd: 'l', label: 'L1', img: 'l.png', w: 0.055, h: 0.03 },
  { cmd: 'r', label: 'R1', img: 'r.png', w: 0.055, h: 0.03 },
  { cmd: 'l2', label: 'L2', img: 'l2.png', w: 0.055, h: 0.03 },
  { cmd: 'r2', label: 'R2', img: 'r2.png', w: 0.055, h: 0.03 },
  { cmd: 'l3', label: 'L3', img: 'l3.png', w: 0.045, h: 0.045 },
  { cmd: 'r3', label: 'R3', img: 'r3.png', w: 0.045, h: 0.045 },
  // Analog
  { cmd: 'analog_left', label: 'Left Stick', img: 'analog-left.png', w: 0.06, h: 0.06 },
  { cmd: 'analog_right', label: 'Right Stick', img: 'analog-right.png', w: 0.06, h: 0.06 },
  // RetroArch functions
  { cmd: 'menu_toggle', label: 'Menu', img: 'menu.png', w: 0.035, h: 0.035 },
  { cmd: 'save_state', label: 'Save State', img: 'save-state.png', w: 0.045, h: 0.045 },
  { cmd: 'load_state', label: 'Load State', img: 'load-state.png', w: 0.045, h: 0.045 },
  { cmd: 'rewind', label: 'Rewind', img: 'rewind.png', w: 0.035, h: 0.035 },
  { cmd: 'fast_forward', label: 'Fast Forward', img: 'fast-forward.png', w: 0.035, h: 0.035 },
  { cmd: 'pause_toggle', label: 'Pause', img: 'pause.png', w: 0.055, h: 0.032 },
  { cmd: 'overlay_next', label: 'Next Overlay', img: 'overlay-next.png', w: 0.045, h: 0.045 },
  { cmd: 'osk_toggle', label: 'Keyboard', img: 'osk.png', w: 0.045, h: 0.045 },
];

/** find art by desc command (case-insensitive, first match) */
export const artForCmd = (cmd: string) =>
  BUTTON_ART.find((b) => b.cmd.toLowerCase() === cmd.toLowerCase());
