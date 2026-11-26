// Original, fictional genre mascots. The same artwork is used in the picker and saved profiles.
export const MOVIE_AVATARS = {
  moonwalker: {
    name: "Moonwalker",
    background: "#282b60",
    art: `<path fill="#6666a5" d="M0 51 21 43l17 7 26-11v25H0Z"/><path fill="#ffdf89" d="M13 12v10m-5-5h10m31-8v8m-4-4h8" stroke="#ffdf89" stroke-width="1.5"/><path fill="#e7e4fa" d="M14 64V55Q14 45 32 45t18 10v9Z"/><rect x="15" y="16" width="34" height="34" rx="15" fill="#f9edda"/><rect x="18" y="23" width="28" height="20" rx="9" fill="#111835"/><path d="m23 32 9-5m-8 11 15-9" stroke="#92d9f3" stroke-width="2" stroke-linecap="round"/><path d="M29 57h6" stroke="#d65359" stroke-width="3"/>`,
  },
  sleuth: {
    name: "Night Sleuth",
    background: "#263b43",
    art: `<path fill="#385b62" d="M2 0h13l37 64H37Zm25 0h7l30 51v12Z"/><circle cx="49" cy="13" r="6" fill="#ffd580"/><path fill="#141b22" d="M10 64v-8q1-11 22-14 21 3 22 14v8Z"/><path fill="#d5a56e" d="M21 28h22v12q-3 10-11 10t-11-10Z"/><path fill="#141b22" d="m11 32 10-5 2-13 12-3 7 15 11 4v4H11Z"/><path stroke="#d38369" stroke-width="3" d="m22 25 19-3"/><path stroke="#141b22" stroke-width="2" d="M24 37h6m5 0h5"/><path fill="#f9d8a4" d="m24 47 8 5 8-5-8 17Z"/>`,
  },
  kaiju: {
    name: "Kaiju Kid",
    background: "#63315b",
    art: `<circle cx="32" cy="29" r="19" fill="#ffae91"/><path fill="#402243" d="M0 64V42h9v-9h9v31Zm46 0V39h7v-6h7v10h4v21Z"/><path fill="#dbce63" d="m14 44-3-8 10 1 1-14 9 6 9-7 4 12 8 1-4 10Z"/><path fill="#87ba77" d="M13 64V47q0-15 19-15t19 15v17Z"/><path fill="#314943" d="M21 44h7v5h-7Zm15 0h7v5h-7Z"/><path d="M25 53q7 5 14 0" fill="none" stroke="#314943" stroke-width="2" stroke-linecap="round"/><path fill="#fff6d9" d="m25 54 4 1-2 4Zm10 1 4-1-2 5Z"/>`,
  },
  driver: {
    name: "Neon Driver",
    background: "#31234d",
    art: `<circle cx="32" cy="27" r="18" fill="#f28b71"/><path d="M8 28h48M8 34h48M8 40h48" stroke="#31234d" stroke-width="2"/><path fill="#534477" d="m28 37-22 27h52L37 37Z"/><path d="m32 46 1 17" stroke="#dec4fc" stroke-width="2" stroke-dasharray="4 4"/><path fill="#171526" d="M13 49h38v8h-5v3h-6v-3H24v3h-6v-3h-5Z"/><path fill="#df70ad" d="m14 46 6-3 5-8h15l5 8 6 3v8H13Z"/><path fill="#291b47" d="m23 43 4-6h11l4 6Z"/><path d="M16 48h7m18 0h7" stroke="#fff4ad" stroke-width="3"/>`,
  },
  ghost: {
    name: "Reel Ghost",
    background: "#48406a",
    art: `<circle cx="45" cy="16" r="10" fill="#7e70a6"/><circle cx="46" cy="13" r="2" fill="#b8a6cc"/><circle cx="49" cy="18" r="2" fill="#b8a6cc"/><circle cx="41" cy="18" r="2" fill="#b8a6cc"/><path d="M2 53q19-9 60 0M0 58q22-7 64 1" stroke="#6e618e" stroke-width="2" fill="none"/><path fill="#e1def4" d="M13 53V36a19 19 0 0 1 38 0v17l-7-4-6 4-6-4-6 4-6-4Z"/><circle cx="25" cy="36" r="3" fill="#33294c"/><circle cx="39" cy="36" r="3" fill="#33294c"/><path fill="#f29d98" d="M18 43h6v2h-6Zm22 0h6v2h-6Z"/><path d="M29 43q3 4 6 0" stroke="#33294c" stroke-width="2" fill="none"/>`,
  },
  robot: {
    name: "Tin Hero",
    background: "#864735",
    art: `<path fill="#ac6345" d="M0 17 17 0h10L0 28ZM42 64l22-22v8L50 64Z"/><path d="m34 17 7-8" stroke="#e2a67e" stroke-width="3"/><circle cx="42" cy="8" r="3" fill="#f7cf6a"/><path fill="#4c747a" d="M14 64v-6l11-8h14l11 8v6Z"/><rect x="14" y="17" width="36" height="35" rx="6" fill="#98b6b0"/><path fill="#54737a" d="M11 25h6v17h-6Zm36 0h6v17h-6Z"/><rect x="20" y="25" width="24" height="14" rx="4" fill="#263f49"/><path d="M26 32h2m8 0h2" stroke="#fff299" stroke-width="4" stroke-linecap="round"/><path d="M26 45h12m-9-2v4m6-4v4" stroke="#263f49" stroke-width="1.5"/>`,
  },
  spellbinder: {
    name: "Spellbinder",
    background: "#233f42",
    art: `<path fill="#54736a" d="M0 62 10 43l11 21Zm45 2 10-26 9 19v7Z"/><path d="M12 17v8m-4-4h8m36 1v10m-5-5h10M46 8v6m-3-3h6" stroke="#e6cd72" stroke-width="1.5"/><path fill="#75658b" d="M13 64v-7l19-12 19 12v7Z"/><path fill="#ddab8c" d="M21 32h22v15l-11 7-11-7Z"/><path fill="#ded8d1" d="m23 44 9 4 9-4-3 12-6 8-6-8Z"/><path fill="#211c39" d="M9 35q2-4 12-6l8-18 15-5-7 11 7 12q11 2 11 7-10 5-23 4-17 0-23-5Z"/><path d="m23 28 19 1" stroke="#a983bd" stroke-width="3"/><path d="M25 42h4m6 0h4" stroke="#342831" stroke-width="1.5"/>`,
  },
  projectionist: {
    name: "Projectionist",
    background: "#5b3442",
    art: `<path fill="#ad7154" d="m42 34 22-14v39L42 44Z"/><path fill="#e6ad74" d="m43 37 21-9v21l-21-7Z"/><circle cx="24" cy="21" r="11" fill="#efc49a"/><circle cx="40" cy="24" r="8" fill="#d99077"/><path fill="#69444a" d="M22 14h4v4h-4Zm-4 6h4v4h-4Zm8 0h4v4h-4Zm-4 6h4v4h-4Zm16-6h4v4h-4Zm3 5h4v4h-4Z"/><rect x="13" y="31" width="29" height="17" rx="3" fill="#291e33"/><path fill="#291e33" d="m40 35 7-3v15l-7-4Zm-13 11h3l8 18h-5l-5-11-5 11h-5Z"/><path d="M19 39h7" stroke="#f2b97f" stroke-width="2" stroke-linecap="round"/>`,
  },
} as const;

export type MovieAvatarId = keyof typeof MOVIE_AVATARS;
export const MOVIE_AVATAR_IDS = Object.keys(MOVIE_AVATARS) as MovieAvatarId[];

export function movieAvatarSvg(id: MovieAvatarId) {
  const { background, art } = MOVIE_AVATARS[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64"><path fill="${background}" d="M0 0h64v64H0z"/>${art}</svg>`;
}
