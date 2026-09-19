// Google Analytics 4 for Duka Bee (tag G-72B43QCD46). One shared file so every page, including the stores
// the browser renders at runtime, behaves the same. It is the standard gtag.js setup, loaded from here.
//
//  - localhost / private networks: events are recorded in window.dataLayer (handy for testing) but the Google
//    tag is NOT loaded, so nothing is sent and your own testing never pollutes the reports.
//  - window.dukabeeTrack(name, params): fire an event from code.
//  - data-track="event_name" on any element: fire that event when it is clicked. Extra data-track-* attributes
//    become event parameters (data-track-niche="clothing" sends niche: "clothing").
//  - Never send personal data (names, phone numbers, store names) as parameters.
(() => {
  const ID = 'G-72B43QCD46';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };

  const host = location.hostname;
  const isLocal = location.protocol === 'file:' || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(host) || host.endsWith('.local');

  if (!isLocal) {
    window.gtag('js', new Date());
    window.gtag('config', ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
    document.head.appendChild(s);
  }

  window.dukabeeTrack = (name, params = {}) => {
    try {
      window.gtag('event', name, params);
      if (isLocal) console.debug('[analytics: not sent, local]', name, params);
    } catch { /* analytics must never break the page */ }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    const params = {};
    for (const [key, value] of Object.entries(el.dataset)) {
      if (key.startsWith('track') && key !== 'track') params[key.slice(5).replace(/^./, (c) => c.toLowerCase())] = value;
    }
    window.dukabeeTrack(el.dataset.track, params);
  });
})();
