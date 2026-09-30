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

  load('gatherings').then(renderGatherings).catch(function () { /* keep the built-in list */ });
  window.EMAJANE_CONTENT = { load: load };
})();
