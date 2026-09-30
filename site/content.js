/* EMAJANE content loader.
   Fills the Gatherings list from data so Emma can change it in the admin.
   The HTML already contains a fallback list, so the page works without JavaScript. */
(function () {
  var C = window.EMAJANE_CONFIG || { api: '', demo: true };
  var preview = /[?&]preview=1/.test(location.search);

  function stored(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  /* Order of preference: her unpublished draft (only when previewing), the demo copy (staging only),
     the live API, then the static file shipped with the site. */
  function load(name) {
    if (preview) { var d = stored('emajane-draft:' + name); if (d) return Promise.resolve(d); }
    if (C.demo) { var m = stored('emajane-demo:' + name); if (m) return Promise.resolve(m); }
    function fromFile() {
      return fetch('content/' + name + '.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('file'); return r.json(); });
    }
    if (!C.api) return fromFile();
    return fetch(C.api + '/content/' + name, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('api'); return r.json(); })
      .catch(fromFile);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function safeUrl(u) { return /^https:\/\/[^\s]+$/i.test(u || '') ? u : ''; }

  function renderGatherings(data) {
    var ul = document.querySelector('.dates');
    if (!ul || !data || !Array.isArray(data.items)) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var upcoming = data.items
      .filter(function (g) { return g && /^\d{4}-\d{2}-\d{2}$/.test(g.date) && new Date(g.date + 'T12:00:00') >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

    ul.textContent = '';
    upcoming.forEach(function (g) {
      var d = new Date(g.date + 'T12:00:00');
      var li = el('li');
      var when = el('span', 'd');
      when.appendChild(el('b', null, String(d.getDate()).padStart(2, '0')));
      when.appendChild(el('small', null, d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })));
      var place = el('span', 'place', g.city || '');
      if (g.venue) place.appendChild(el('small', null, g.venue));
      var st = el('span', 'st');
      var link = safeUrl(g.ticketUrl);
      if (g.status === 'soldout') st.textContent = 'Sold out';
      else if (g.status === 'free' && !link) st.textContent = 'Free entry';
      else if (link) {
        var a = el('a', 'btn sm', g.status === 'free' ? 'Details' : 'Tickets');
        a.href = link; a.rel = 'noopener'; st.appendChild(a);
      }
      li.appendChild(when); li.appendChild(place); li.appendChild(st);
      ul.appendChild(li);
    });

    var note = document.getElementById('dates-note');
    if (note) {
      if (!upcoming.length) {
        note.textContent = 'New dates are on the way. Join the letters below to hear first.';
        note.hidden = false;
      } else if (data.placeholder) {
        note.textContent = 'Dates shown are placeholders for this mockup. Each open date links straight to the ticket page.';
        note.hidden = false;
      } else {
        note.hidden = true;
      }
    }
  }

  /* A small label on staging and preview so nobody mistakes local edits for what visitors see. */
  function badge(text, action, onAction) {
    var old = document.getElementById('emajane-badge'); if (old) old.remove();
    if (!text) return;
    var b = document.createElement('div'); b.id = 'emajane-badge'; b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:50;display:flex;gap:14px;align-items:center;max-width:calc(100vw - 32px);padding:10px 14px;background:#15130F;border:1px solid #7A5A3A;color:#D8CFC0;font-family:var(--f-inscr);font-size:11px;line-height:1.4;letter-spacing:.14em;text-transform:uppercase';
    var s = document.createElement('span'); s.textContent = text; b.appendChild(s);
    var a = document.createElement('button'); a.type = 'button'; a.textContent = action; a.onclick = onAction;
    a.style.cssText = 'font:inherit;letter-spacing:inherit;text-transform:inherit;color:#EFE9DF;background:none;border:1px solid #8C8478;padding:6px 10px;cursor:pointer;white-space:nowrap';
    b.appendChild(a); document.body.appendChild(b);
  }

  var latest = 0;
  function show() {
    var mine = ++latest;   /* several storage writes arrive in quick succession; only the newest refresh may draw */
    load('gatherings').then(function (data) {
      if (mine !== latest) return;
      renderGatherings(data);
      if (preview && stored('emajane-draft:gatherings')) badge('Previewing changes that are not published yet', 'Close preview', function () { location.href = location.pathname + location.hash; });
      else if (C.demo && stored('emajane-demo:gatherings')) badge('Showing the practice edits saved in this browser', 'Reset', function () {
        try { localStorage.removeItem('emajane-demo:gatherings'); localStorage.removeItem('emajane-demo-prev:gatherings'); } catch (e) {}
        location.reload();
      });
      else badge();
    }).catch(function () { /* keep the built-in list */ });
  }
  show();
  /* Publishing or editing in another tab of this browser updates this page without a refresh. */
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('emajane-') === 0) show(); });
  window.EMAJANE_CONTENT = { load: load };
})();
