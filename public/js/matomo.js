// Matomo (matomo.mcfrojd.se, site 2).
// The first path segment of /<key>/ and /<key>/admin/ is the session's secret
// key, and the page title can contain the club name. Neither may reach Matomo,
// so the URL and title are replaced before anything is tracked.
var _paq = window._paq = window._paq || [];
(function () {
  var parts = location.pathname.split('/');
  if (/^[A-Za-z0-9]{12}$/.test(parts[1] || '')) {
    parts[1] = 'KEY';
    var isAdmin = parts[2] === 'admin';
    _paq.push(['setCustomUrl', location.origin + parts.join('/')]);
    _paq.push(['setDocumentTitle', isAdmin ? 'Admin' : 'Display']);
    _paq.push(['setReferrerUrl', '']);
  }
})();
// No cookies until the visitor accepts in the banner on the start page (consent.js).
_paq.push(['requireCookieConsent']);
/* tracker methods like "setCustomDimension" should be called before "trackPageView" */
_paq.push(['trackPageView']);
_paq.push(['enableLinkTracking']);
(function () {
  var u = 'https://matomo.mcfrojd.se/';
  _paq.push(['setTrackerUrl', u + 'matomo.php']);
  _paq.push(['setSiteId', '2']);
  var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
  g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
})();
