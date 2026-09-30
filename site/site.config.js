/* Where the page finds its content.
   staging  (github.io, or a file opened locally): static JSON in /content, admin runs in demo mode (saves to this browser only)
   live     (any other host, including wrangler dev): the Cloudflare Worker at /api */
(function () {
  var h = location.hostname;
  var staging = /github\.io$/.test(h) || location.protocol === 'file:';
  window.EMAJANE_CONFIG = { api: staging ? '' : '/api', demo: staging };
})();
