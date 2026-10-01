/* Where the page finds its content.
   staging  (github.io, a *.localhost address, or a file opened locally): content comes from the files in /content,
            and the admin works in practice mode (everything is kept in this browser only)
   live     (any other address, including wrangler dev): content comes from the Cloudflare Worker at /api */
(function () {
  var h = location.hostname;
  var staging = /(^|\.)github\.io$/.test(h) || /\.localhost$/.test(h) || location.protocol === 'file:';
  window.EMAJANE_CONFIG = { api: staging ? '' : '/api', demo: staging, support: '' };
})();
