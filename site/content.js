/* EMAJANE content loader.

   Fills the page from the content Emma edits in the admin. The HTML already holds
   a full copy of the starting text, so the page is complete without JavaScript
   and stays complete if anything below fails.

   Everything from the content is put on the page as plain text. Nothing is ever
   inserted as HTML, and web addresses are only used when they start with https://. */
(function () {
  var C = window.EMAJANE_CONFIG || { api: '', demo: true };
  var NAMES = ['gatherings', 'album', 'words', 'shop', 'photos', 'contact'];
  var preview = /[?&]preview=1/.test(location.search);

  function stored(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function storedRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* ---- finding the content -------------------------------------------------------------------- */
  /* Order of preference: unpublished changes (only when previewing), the practice copy (staging only),
     what is published, then the starting file that ships with the site. */
  function loadAll() {
    var fromApi = C.api
      ? fetch(C.api + '/content', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      : Promise.resolve({});
    return fromApi.then(function (api) {
      return Promise.all(NAMES.map(function (n) {
        if (preview) { var d = stored('emajane-draft:' + n); if (d) return [n, d]; }
        if (C.demo) { var m = stored('emajane-demo:' + n); if (m) return [n, m]; }
        if (api[n]) return [n, api[n]];
        return fetch('content/' + n + '.json', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) { return [n, data]; })
          .catch(function () { return [n, null]; });
      }));
    }).then(function (pairs) {
      var docs = {};
      pairs.forEach(function (p) { docs[p[0]] = p[1]; });
      return docs;
    });
  }

  /* ---- small helpers -------------------------------------------------------------------------- */
  function safeUrl(u) { return /^https:\/\/[^\s]+$/i.test(u || '') ? u : ''; }

  function imageSrc(ref) {
    if (!ref) return '';
    var m = /^\/media\/([a-f0-9]+)$/.exec(ref);
    if (m && C.demo) return storedRaw('emajane-media:' + m[1]) || '';   // practice pictures live in this browser
    return ref;
  }

  function setLink(a, value, fallback) {
    var hideEmpty = a.hasAttribute('data-hide-if-empty');
    var url = /^mailto:/.test(value || '') ? value : (safeUrl(value) || '');
    var target = url || fallback || '';
    var holder = a.parentNode && a.parentNode.nodeName === 'LI' ? a.parentNode : null;   // a list slot that only holds this link
    if (!target) { if (hideEmpty) { a.hidden = true; if (holder) holder.hidden = true; } return; }
    a.hidden = false;
    if (holder) holder.hidden = false;
    a.setAttribute('href', target);
    if (/^https:/.test(target)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); }
  }

  /* ---- sections ------------------------------------------------------------------------------- */
  function bindText(docs) {
    $all('[data-bind]').forEach(function (node) {
      var v = get(docs, node.getAttribute('data-bind'));
      if (typeof v !== 'string') return;
      node.textContent = v;
      node.hidden = v === '';
    });
  }

  function bindLinks(docs) {
    $all('[data-link]').forEach(function (a) {
      setLink(a, get(docs, a.getAttribute('data-link')), a.getAttribute('data-fallback'));
    });
  }

  function bindPhotos(docs) {
    var p = docs.photos;
    if (!p) return;
    $all('[data-photo]').forEach(function (img) {
      var slot = img.getAttribute('data-photo');
      var src = imageSrc(p[slot]);
      if (src) img.setAttribute('src', src);
      if (typeof p[slot + 'Alt'] === 'string' && p[slot + 'Alt']) img.setAttribute('alt', p[slot + 'Alt']);
    });
  }

  function renderTagline(docs) {
    var box = document.querySelector('[data-tagline]');
    var list = docs.album && docs.album.tagline;
    if (!box || !Array.isArray(list)) return;
    box.textContent = '';
    box.hidden = !list.length;
    list.forEach(function (phrase, i) {
      if (i) box.appendChild(el('span', 'sep', ' · '));
      box.appendChild(el('span', 'nb', phrase));
    });
  }

  function renderTracks(docs) {
    var ol = document.querySelector('[data-tracks]');
    var list = docs.album && docs.album.tracks;
    if (!ol || !Array.isArray(list)) return;
    ol.textContent = '';
    ol.hidden = !list.length;
    list.forEach(function (name) {
      var li = el('li');
      li.appendChild(el('span', null, name));
      ol.appendChild(li);
    });
  }

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
        a.href = link; a.target = '_blank'; a.rel = 'noopener'; st.appendChild(a);
      }
      li.appendChild(when); li.appendChild(place); li.appendChild(st);
      ul.appendChild(li);
    });

    var note = document.getElementById('dates-note');
    if (note) {
      if (!upcoming.length) { note.textContent = 'New dates are on the way. Join the letters below to hear first.'; note.hidden = false; }
      else if (data.placeholder) { note.textContent = 'Dates shown are placeholders for this mockup. Each open date links straight to the ticket page.'; note.hidden = false; }
      else note.hidden = true;
    }
  }

  var TEE = 'M62 10 L20 40 L32 82 L46 74 L46 210 L154 210 L154 74 L168 82 L180 40 L138 10 C 128 36, 72 36, 62 10 Z';

  function shopPicture(it, cover) {
    var obj = el('div', 'obj');
    if (it.image && imageSrc(it.image)) {
      var photo = el('img', 'photo'); photo.src = imageSrc(it.image); photo.alt = it.name || ''; obj.appendChild(photo);
    } else if (it.look === 'cd') {
      var cd = el('div', 'cd'), ci = el('img'); ci.src = cover; ci.alt = ''; cd.appendChild(ci); obj.appendChild(cd);
    } else if (it.look === 'tee') {
      var tee = el('div', 'tee');
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'shape'); svg.setAttribute('viewBox', '0 0 200 220'); svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', TEE); svg.appendChild(path);
      var eye = el('img', 'eye'); eye.src = 'assets/eye-bone.png'; eye.alt = '';
      tee.appendChild(svg); tee.appendChild(eye); obj.appendChild(tee);
    } else {
      obj.className = 'obj vinyl';
      var sleeve = el('img', 'sleeve'); sleeve.src = cover; sleeve.alt = '';
      var disc = el('div', 'disc'); disc.setAttribute('aria-hidden', 'true');
      obj.appendChild(sleeve); obj.appendChild(disc);
    }
    return obj;
  }

  function renderShop(docs) {
    var shop = docs.shop;
    var ul = document.querySelector('[data-shop]');
    if (!ul || !shop || !Array.isArray(shop.items)) return;
    var cover = imageSrc(docs.photos && docs.photos.albumCover) || 'assets/album-art.jpg';
    var albumTitle = String((docs.album && docs.album.title) || '').toLowerCase();
    ul.textContent = '';
    shop.items.forEach(function (it) {
      var li = el('li', 'good');
      li.appendChild(shopPicture(it, cover));
      var isAlbum = albumTitle && String(it.name || '').toLowerCase() === albumTitle;   // the album's name is always set in capitals
      var name = el('p', 'name' + (isAlbum ? ' caps' : ''), it.name || '');
      if (it.note) name.appendChild(el('small', null, it.note));
      li.appendChild(name);
      if (it.price) li.appendChild(el('p', 'price', it.price));
      var url = safeUrl(it.buyUrl);
      if (it.status === 'soldout') li.appendChild(el('p', 'soon', 'Sold out'));
      else if (url) { var a = el('a', 'link buy', 'Buy'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); }
      else li.appendChild(el('p', 'soon', 'Coming soon'));
      ul.appendChild(li);
    });
    var note = document.getElementById('shop-note');
    if (note) note.hidden = !shop.placeholder;
    $all('[data-shop-all]').forEach(function (a) { setLink(a, shop.allUrl); });
  }

  function renderContact(docs) {
    var c = docs.contact;
    if (!c) return;
    var EMAIL = /^[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
    $all('[data-mail]').forEach(function (a) {
      var addr = c[a.getAttribute('data-mail')];
      var ok = typeof addr === 'string' && EMAIL.test(addr);
      var subject = a.getAttribute('data-subject');
      if (ok) a.setAttribute('href', 'mailto:' + addr + (subject ? '?subject=' + encodeURIComponent(subject) : ''));
      var holder = a.closest('li');
      (holder || a).hidden = !ok;
    });
    var navContact = document.querySelector('[data-nav-contact]');
    if (navContact) {
      var addr2 = c.contactEmail;
      navContact.setAttribute('href', EMAIL.test(addr2 || '') ? 'mailto:' + addr2 : '#contact');
    }
    $all('[data-year]').forEach(function (n) { n.textContent = String(new Date().getFullYear()); });
  }

  /* A small label so nobody mistakes unpublished or practice edits for what visitors see. */
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

  function anyDraft() { return NAMES.some(function (n) { return !!stored('emajane-draft:' + n); }); }
  function anyPractice() { return NAMES.some(function (n) { return !!stored('emajane-demo:' + n); }); }

  /* ---- put it all on the page ----------------------------------------------------------------- */
  var latest = 0;
  function show() {
    var mine = ++latest;   /* several storage writes arrive together; only the newest refresh may draw */
    loadAll().then(function (docs) {
      if (mine !== latest) return;
      bindText(docs);
      bindLinks(docs);
      bindPhotos(docs);
      renderTagline(docs);
      renderTracks(docs);
      renderGatherings(docs.gatherings);
      renderShop(docs);
      renderContact(docs);

      if (preview && anyDraft()) badge('Previewing changes that are not published yet', 'Close preview', function () { location.href = location.pathname + location.hash; });
      else if (C.demo && anyPractice()) badge('Showing the practice edits saved in this browser', 'Reset', function () {
        try { Object.keys(localStorage).filter(function (k) { return /^emajane-(demo|demo-prev|demo-meta):/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
        location.reload();
      });
      else badge();
    }).catch(function () { /* keep the built-in text */ });
  }
  show();
  /* Publishing or editing in another tab of this browser updates this page without a refresh. */
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('emajane-') === 0) show(); });
  window.EMAJANE_CONTENT = { reload: show };
})();
