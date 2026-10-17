// Icon SVG nét đơn giản dùng trong giao diện
const sv = (w, body, fill) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
export const I = {
  gear: sv(18, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: sv(22, '<path d="M12 5v14M5 12h14"/>'),
  plus14: sv(15, '<path d="M12 5v14M5 12h14"/>'),
  lock: sv(11, '<path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z"/>', true),
  unlock: sv(11, '<path d="M9 10V7a3 3 0 0 1 5.8-1l1.9-.7A5 5 0 0 0 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2z"/>', true),
  lock16: sv(16, '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  fp: `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 11v3a8 8 0 0 1-1.5 4.6"/><path d="M8.5 8.6A4 4 0 0 1 16 11v1.5"/><path d="M16 15.5a13 13 0 0 1-.8 3.7"/><path d="M8 11v2a6 6 0 0 1-1.2 3.6"/><path d="M5 9.5A7.5 7.5 0 0 1 19.5 11v1"/><path d="M4.2 13.5V12"/><path d="M7 4.9A10 10 0 0 1 20.6 7.5"/></svg>`,
  search: sv(16, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  chev: sv(16, '<path d="M6 9l6 6 6-6"/>'),
  eye: sv(15, '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: sv(15, '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  copy: sv(15, '<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  pen: sv(15, '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>'),
  trash: sv(15, '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  grip: `<svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/></svg>`,
  up: `<svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 7l4-4 4 4"/></svg>`,
  dn: `<svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 3l4 4 4-4"/></svg>`,
  back: sv(16, '<path d="M15 6l-6 6 6 6"/>'),
  dots: sv(16, '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>', true),
  x: sv(16, '<path d="M6 6l12 12M18 6L6 18"/>'),
  x14: sv(13, '<path d="M6 6l12 12M18 6L6 18"/>'),
  sun: sv(13, '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: sv(13, '<path d="M21 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10.5 10.5z"/>', true)
};
