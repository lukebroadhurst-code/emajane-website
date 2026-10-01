/* Simple line pictures that sit next to words in the admin.
   They always come with words, so nobody has to guess what a picture means. */

const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  check: 'M4 12.5l5 5L20 6.5',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  picture: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M16 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8.5 12h7M8.5 16h7',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  undo: 'M9 7H4V2M4 7a9 9 0 11-1 6',
  warning: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.5',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z',
  chat: 'M4 5h16v11H9l-5 4V5z',
  bag: 'M5 8h14l1 13H4L5 8zM8 8V6a4 4 0 018 0v2',
  mail: 'M3 5h18v14H3zM3 6.5l9 7 9-7',
  close: 'M6 6l12 12M18 6L6 18',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2.2M12 17v.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
};

export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', ('icon ' + className).trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', PATHS[name] || PATHS.info);
  svg.appendChild(path);
  return svg;
}

export const ICON_NAMES = Object.keys(PATHS);
