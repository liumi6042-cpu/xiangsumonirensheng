const honey = '#F5C143';
const sage = '#8BC99E';
const coral = '#F39783';
const sky = '#9CC9ED';
const paper = '#FFF9EE';
const oak = '#D9AF83';
const lilac = '#CBB9DD';

const drawings = {
  sun: `<circle cx="12" cy="12" r="4.5" fill="${honey}"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>`,
  sunset: `<path d="M5 16a7 7 0 0 1 14 0" fill="${coral}"/><path d="M2 16h20M5 20h14M12 2v3M3 7l2 2m16-2-2 2"/>`,
  moon: `<path d="M19.8 15.7A9 9 0 0 1 9 3.1a9.2 9.2 0 1 0 10.8 12.6Z" fill="${honey}"/><path d="m18 3 .7 2.3L21 6l-2.3.7L18 9l-.7-2.3L15 6l2.3-.7Z" fill="${paper}" stroke-width="1.4"/>`,
  sunrise: `<path d="M6 17a6 6 0 0 1 12 0" fill="${honey}"/><path d="M2 17h20M5 21h14M12 8V2m-3 3 3-3 3 3M3 10l2 2m16-2-2 2"/>`,
  pause: `<rect x="5" y="4" width="5" height="16" rx="2" fill="${oak}"/><rect x="14" y="4" width="5" height="16" rx="2" fill="${oak}"/>`,
  play: `<path d="M7 4.5Q6 4 6 6v12q0 2 1.5 1l12-6q1.5-1 0-2Z" fill="${sage}"/>`,
  fast: `<path d="m3 5 9 7-9 7Zm10 0 9 7-9 7Z" fill="${sky}"/>`,
  turbo: `<path d="m13 2-9 12h7l-1 8 10-14h-8Z" fill="${honey}"/>`,
  coin: `<circle cx="12" cy="12" r="9" fill="${honey}"/><circle cx="12" cy="12" r="6.3" stroke="#CA8D28" stroke-width="1.2"/><path d="M14.5 9.2a3.6 3.6 0 1 0 .1 5.5v-2.3h-2.4"/>`,
  residents: `<circle cx="16.5" cy="8" r="3.5" fill="${oak}"/><path d="M12 19v-2a5 5 0 0 1 10 0v2Z" fill="${sky}"/><circle cx="8" cy="7.5" r="4" fill="#F8D5AE"/><path d="M2 20v-2a6 6 0 0 1 12 0v2Z" fill="${sage}"/>`,
  expand: `<path d="M3 10h12v5h6v6H3Z" fill="${coral}"/><path d="M3 15h12m-7 0v6m3-11v5M18 2v7m-3-3 3-4 3 4"/>`,
  decorate: `<path d="M5 13V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4" fill="${sage}"/><path d="M3 10q3-1 3 3v1h12v-1q0-4 3-3 2 1 1 4l-1 4H3l-1-4q-1-3 1-4Z" fill="${sage}"/><path d="M5 18v3m14-3v3"/>`,
  check: `<path d="m3 12 6 6L21 6l-3-2-9 9-3-4Z" fill="${sage}"/>`,
  map: `<path d="m2 5 7-2 7 3 6-2v15l-6 2-7-3-7 2Z" fill="${sage}"/><path d="M9 3v15l7 3V6Z" fill="${paper}"/><path d="m4.5 12 2-2m4.5 1 2 2m4.5 0 2-2" stroke="#955D40"/>`,
  camera: `<path d="M3 7h4l2-3h6l2 3h4v13H3Z" fill="${sky}"/><circle cx="12" cy="13" r="4" fill="${paper}"/><path d="M18 10h1"/>`,
  eyeOff: `<path d="M2 12q10-13 20 0-10 13-20 0Z" fill="${paper}"/><circle cx="12" cy="12" r="3" fill="${sky}"/><path d="M3 3l18 18"/>`,
  help: `<circle cx="12" cy="12" r="9" fill="${lilac}"/><path d="M9.4 9a2.7 2.7 0 1 1 4.4 2.2Q12 12.2 12 14m0 3h.01"/>`,
  stairs: `<path d="M2 16h6v-5h6V6h7v15H2Z" fill="${oak}"/><path d="M3 11 10 4M5 4h5v5"/>`,
  floor: `<path d="m2 11 10-6 10 6-10 6Z" fill="${oak}"/><path d="m2 15 10 6 10-6"/>`,
  arrowLeft: `<path d="m14.5 5-8 7 8 7" stroke-width="3"/>`,
  arrowRight: `<path d="m9.5 5 8 7-8 7" stroke-width="3"/>`,
  close: `<path d="m6 6 12 12M18 6 6 18" stroke-width="2.6"/>`,
  move: `<path d="M12 2v20M2 12h20M9 5l3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>`,
  palette: `<path d="M21 10c0 4-4 5-7 4-2-.5-3 1-2 3s0 4-3 3C0 18 1 6 9 3c6-2 11 1 12 7Z" fill="${oak}"/><g stroke-width="1"><circle cx="7" cy="9" r="1.7" fill="${coral}"/><circle cx="12" cy="6.5" r="1.7" fill="${honey}"/><circle cx="17" cy="9" r="1.7" fill="${sky}"/></g>`,
  flip: `<path d="M12 2v3m0 3v3m0 3v3m0 3v2"/><path d="m2 18 6-11v11Z" fill="${sky}"/><path d="m22 18-6-11v11Z" fill="${lilac}"/>`,
  box: `<path d="m2 7 10-4 10 4v11l-10 4-10-4Z" fill="${oak}"/><path d="m2 7 10 4 10-4m-10 4v11m-6-17 10 4v4"/>`,
  sell: `<path d="M3 4h9l9 9-8 8L3 11Z" fill="${honey}"/><circle cx="7.5" cy="8" r="1.4" fill="${paper}"/>`,
  wave: `<path d="m5 13-2-4q0-3 2-2l3 4-2-7q1-2 3-1l2 7-1-7q1-2 3-1l1 8 1-6q2-2 3 0l-1 9 2-2q3-2 3 1l-4 7q-4 5-9 1Z" fill="#F6CF9B"/>`,
  walk: `<circle cx="14" cy="4" r="2.5" fill="${oak}"/><path d="m6 12 4-4 4 1 2 4 4 1m-7-5-2 7 4 5m-4-5-5 5" stroke-width="2.6"/>`,
  chair: `<rect x="6" y="2" width="12" height="10" rx="3" fill="${sage}"/><path d="M5 12h14v4H5Z" fill="${oak}"/><path d="m7 16-1 6m11-6 1 6"/>`,
  sleep: `<path d="M2 8v13m20-7v7M2 17h20v-5h-9q-2 0-2 3H2" fill="${lilac}"/><circle cx="6" cy="12" r="2.5" fill="${paper}"/><path d="M15 3h5l-5 5h5"/>`,
  paw: `<g fill="${oak}"><ellipse cx="5" cy="10" rx="2.2" ry="3"/><ellipse cx="10" cy="6" rx="2.2" ry="3"/><ellipse cx="16" cy="6.5" rx="2.2" ry="3"/><ellipse cx="20" cy="11" rx="2" ry="2.8"/><path d="M6 17q1-2 3-4 3-4 6 0l3 4q2 5-3 4-3-2-6 0-5 1-3-4Z"/></g>`,
  sparkle: `<path d="m10 3 2.3 6.7L19 12l-6.7 2.3L10 21l-2.3-6.7L1 12l6.7-2.3Z" fill="${honey}"/><path d="m19 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="${coral}" stroke-width="1.2"/>`,
  home: `<path d="M5 10h14v11H5Z" fill="${paper}"/><path d="m2 11 10-9 10 9h-4l-6-5-6 5Z" fill="${coral}"/><path d="M10 21v-7h5v7" fill="${sage}"/>`,
  wrench: `<path d="M21 3a6 6 0 0 1-7.5 8L6 20q-3 3-5-1l9-9a6 6 0 0 1 8-8l-4 4 3 2Z" fill="${sky}"/>`,
  paint: `<rect x="3" y="3" width="13" height="7" rx="2" fill="${sage}"/><path d="M16 6h4v6l-8 2v3"/><rect x="10" y="16" width="4" height="6" rx="1.5" fill="${oak}"/>`,
  store: `<path d="M4 9h16v12H4Z" fill="${paper}"/><path d="m3 4-2 6q2 4 5 1 3 3 6 0 3 3 6 0 3 3 5-1l-3-6Z" fill="${coral}"/><path d="M8 21v-6h5v6m3-6h2"/>`,
  cup: `<path d="M4 8h13v4q0 7-6.5 7T4 12Z" fill="${sky}"/><path d="M17 9h2q5 2 0 6h-3M3 21h16M8 2v3m5-3v3"/>`,
  bread: `<path d="M3 14C0 7 8 3 15 4c7 1 9 9 5 12l-13 4q-5 1-4-6Z" fill="${oak}"/><path d="m7 7 3 4m2-6 3 4m2-4 3 4"/>`,
  scissors: `<circle cx="6" cy="17" r="3.5" fill="${coral}"/><circle cx="17" cy="17" r="3.5" fill="${sky}"/><path d="m8 14 11-12m-4 12L5 2"/>`,
  blossom: `<path d="M12 7c-5-9-12-2-7 3-8 1-3 10 3 7 1 8 10 5 9-1 8 2 9-7 2-8 1-7-6-8-7-1Z" fill="#EEB7C7"/><circle cx="12" cy="12" r="2.4" fill="${honey}"/>`,
  bolt: `<path d="M13 2 4 14h7l-1 8 10-12h-7Z" fill="${honey}"/>`,
  smile: `<circle cx="12" cy="12" r="9" fill="${coral}"/><circle cx="9" cy="10" r="1" fill="#2B1810"/><circle cx="15" cy="10" r="1" fill="#2B1810"/><path d="M8.5 14.5q3.5 3 7 0"/>`,
  laptop: `<rect x="4" y="5" width="16" height="10" rx="2" fill="${sky}"/><path d="M2 19h20l-2-4H4Z" fill="${oak}"/>`,
  gift: `<rect x="3" y="8" width="18" height="13" rx="2" fill="${coral}"/><path d="M12 8v13M3 13h18" stroke="${paper}"/><path d="M12 8q-5-5-6 0t6 0q5-5 6 0t-6 0" fill="${honey}"/>`,
  bath: `<path d="M3 12h18v2q0 5-5 5H8q-5 0-5-5Z" fill="${paper}"/><path d="M6 12V6a2.5 2.5 0 0 1 5 0M7 19l-1 2m11-2 1 2"/>`,
} as const;

export type IconName = keyof typeof drawings;

export function iconSvg(name: IconName, size = 20): string {
  return `<span class="ui-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#2B1810" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${drawings[name]}</svg></span>`;
}