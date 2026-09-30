/* EMAJANE brand geometry engine
   Draws the brand's golden-ratio devices programmatically so every
   surface (web, PDF, social) uses the same construction.
   Usage: <div data-geo="chain|spiral|golden-rect|eye|smoke"></div> */
(function () {
  var PHI = (1 + Math.sqrt(5)) / 2;
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* The Chain: the album's recursive circles, rebuilt as a golden 3-split.
     Each segment divides into [1/φ², 1/φ³, 1/φ²] — large, small, large —
     so the proportions are exact and the form stays symmetric. */
  function chain(host) {
    var depth = +host.dataset.depth || 5;
    var svg = el('svg', { viewBox: '-1.04 -1.04 2.08 2.08', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round' }, host);
    var widths = [1.5, 1.1, 0.8, 0.6, 0.45, 0.35, 0.3];
    var alphas = [1, 0.95, 0.85, 0.7, 0.55, 0.42, 0.35];
    var layers = [];
    for (var i = 0; i <= depth; i++) {
      layers.push(el('g', { 'stroke-width': widths[Math.min(i, widths.length - 1)], opacity: alphas[Math.min(i, alphas.length - 1)] }, svg));
    }
    el('circle', { cx: 0, cy: 0, r: 1, 'vector-effect': 'non-scaling-stroke' }, layers[0]);
    if (host.dataset.scurve !== 'off') {
      el('path', { d: 'M0,-1 A0.5,0.5 0 0 1 0,0 A0.5,0.5 0 0 0 0,1', 'vector-effect': 'non-scaling-stroke' }, layers[0]);
    }
    function rec(y0, y1, lvl) {
      if (lvl > depth) return;
      var L = y1 - y0;
      var a = L / (PHI * PHI), b = L / (PHI * PHI * PHI);
      var segs = [[y0, y0 + a], [y0 + a, y0 + a + b], [y0 + a + b, y1]];
      for (var i = 0; i < segs.length; i++) {
        var s0 = segs[i][0], s1 = segs[i][1], r = (s1 - s0) / 2;
        if (r < 0.006) continue;
        el('circle', { cx: 0, cy: (s0 + s1) / 2, r: r, 'vector-effect': 'non-scaling-stroke' }, layers[lvl]);
        rec(s0, s1, lvl + 1);
      }
    }
    rec(-1, 1, 1);
    return svg;
  }

  /* Golden (logarithmic) spiral: r grows by φ every quarter turn. */
  function spiralPath(cx, cy, r0, th0, turns, N, shrink) {
    var b = Math.log(PHI) / (Math.PI / 2);
    var d = '';
    for (var i = 0; i <= N; i++) {
      var th = th0 + (turns * 2 * Math.PI) * i / N;
      var r = shrink ? r0 * Math.exp(-b * (th - th0)) : r0 * Math.exp(b * (th - th0));
      var x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      d += (i ? 'L' : 'M') + x.toFixed(3) + ',' + y.toFixed(3);
    }
    return d;
  }

  function spiral(host) {
    var turns = +host.dataset.turns || 3;
    var svg = el('svg', { viewBox: '-1.05 -1.05 2.1 2.1', fill: 'none', stroke: 'currentColor', 'stroke-width': host.dataset.stroke || 1.2 }, host);
    var b = Math.log(PHI) / (Math.PI / 2);
    var rMax = Math.exp(b * turns * 2 * Math.PI);
    el('path', { d: spiralPath(0, 0, 1 / rMax, 0, turns, 600, false), 'vector-effect': 'non-scaling-stroke' }, svg);
    return svg;
  }

  /* Golden rectangle subdivision with the spiral running through the squares. */
  function goldenRect(host) {
    var steps = +host.dataset.steps || 8;
    var svg = el('svg', { viewBox: '0 0 ' + PHI + ' 1', fill: 'none', stroke: 'currentColor', 'stroke-width': 1, style: 'overflow: visible' }, host);
    var gRect = el('g', { opacity: 0.55, 'stroke-width': 0.8 }, svg);
    var gArc = el('g', { 'stroke-width': 1.6 }, svg);
    var x = 0, y = 0, w = PHI, h = 1, dir = 0, d = '';
    el('rect', { x: x, y: y, width: w, height: h, 'vector-effect': 'non-scaling-stroke' }, gRect);
    for (var i = 0; i < steps; i++) {
      var s = Math.min(w, h), sq, from, to, c;
      if (dir === 0) { sq = { x: x, y: y }; from = [x, y + s]; to = [x + s, y]; x += s; w -= s; }
      else if (dir === 1) { sq = { x: x, y: y }; from = [x, y]; to = [x + s, y + s]; y += s; h -= s; }
      else if (dir === 2) { sq = { x: x + w - s, y: y }; from = [x + w, y]; to = [x + w - s, y + s]; w -= s; }
      else { sq = { x: x, y: y + h - s }; from = [x + s, y + h]; to = [x, y + h - s]; h -= s; }
      el('rect', { x: sq.x, y: sq.y, width: s, height: s, 'vector-effect': 'non-scaling-stroke' }, gRect);
      d += (i ? '' : 'M' + from[0].toFixed(4) + ',' + from[1].toFixed(4)) + ' A' + s.toFixed(4) + ',' + s.toFixed(4) + ' 0 0 1 ' + to[0].toFixed(4) + ',' + to[1].toFixed(4);
      dir = (dir + 1) % 4;
    }
    el('path', { d: d, 'vector-effect': 'non-scaling-stroke' }, gArc);
    return svg;
  }

  /* The Eye: a proposed vector sigil drawn from the existing wordmark's eye.
     Almond lids, iris, pupil, an outer tail, a straight tear and a golden-spiral tear. */
  function eye(host) {
    var sw = host.dataset.stroke || 3;
    var svg = el('svg', { viewBox: '0 0 240 150', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, host);
    el('path', { d: 'M22 74 C62 22 158 22 208 74' }, svg);            /* upper lid */
    el('path', { d: 'M22 74 C62 110 158 110 208 74' }, svg);          /* lower lid */
    el('path', { d: 'M34 48 C74 6 160 4 214 46', 'stroke-width': sw * 0.7, opacity: 0.9 }, svg); /* brow */
    el('circle', { cx: 116, cy: 70, r: 25 }, svg);                    /* iris */
    el('circle', { cx: 116, cy: 70, r: 10, fill: 'currentColor', stroke: 'none' }, svg); /* pupil */
    el('path', { d: 'M208 74 L236 70' }, svg);                        /* outer tail */
    el('path', { d: 'M156 104 L166 142' }, svg);                      /* straight tear */
    /* spiral tear: starts on the lower lid and curls inward */
    var cx = 62, cy = 124, sx = 74, sy = 100;
    var r0 = Math.hypot(sx - cx, sy - cy), th0 = Math.atan2(sy - cy, sx - cx);
    el('path', { d: spiralPath(cx, cy, r0, th0, 1.6, 240, true), 'stroke-width': sw * 0.85 }, svg);
    return svg;
  }

  /* Smoke: bone-coloured light unfurling from below. Fine fractal noise gives the
     body of the smoke its texture; a second turbulence field curls it. No blur,
     so the detail of the unfurling stays visible. Drifts slowly unless reduced motion. */
  function smoke(host) {
    var id = 'smk' + (++uid);
    var color = host.dataset.color || '#EFE9DF';
    var op = host.dataset.opacity ? +host.dataset.opacity : 0.55;
    var seed = +host.dataset.seed || 3;
    function ch(h) { return (parseInt(h, 16) / 255).toFixed(3); }
    var r = ch(color.slice(1, 3)), g = ch(color.slice(3, 5)), b = ch(color.slice(5, 7));
    var box = host.getBoundingClientRect();
    var tall = box.width > 0 && box.height / box.width > 1.3;   /* portrait hero: scale evenly instead of stretching */
    var svg = el('svg', { viewBox: '0 0 1000 600', preserveAspectRatio: tall ? 'xMidYMax slice' : 'none', 'aria-hidden': 'true' }, host);
    var defs = el('defs', {}, svg);
    var f = el('filter', { id: id, x: '-30%', y: '-40%', width: '160%', height: '180%', 'color-interpolation-filters': 'sRGB' }, defs);
    el('feTurbulence', { type: host.dataset.tex || 'fractalNoise', baseFrequency: host.dataset.grain || '0.007 0.012', numOctaves: +host.dataset.octaves || 5, seed: seed, result: 'tex' }, f);
    el('feColorMatrix', { 'in': 'tex', type: 'matrix', values: '0 0 0 0 ' + r + '  0 0 0 0 ' + g + '  0 0 0 0 ' + b + '  ' + (host.dataset.slope || 2.8) + ' 0 0 0 ' + (host.dataset.bias || -1.0), result: 'wisps' }, f);
    el('feComposite', { 'in': 'wisps', in2: 'SourceGraphic', operator: 'in', result: 'shaped' }, f);
    var flow = el('feTurbulence', { type: 'turbulence', baseFrequency: '0.0028 0.0055', numOctaves: 3, seed: seed + 5, result: 'flow' }, f);
    el('feDisplacementMap', { 'in': 'shaped', in2: 'flow', scale: host.dataset.scale || 300, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    el('feGaussianBlur', { stdDeviation: host.dataset.blur || 0.5 }, f);
    var grad = el('radialGradient', { id: id + 'g' }, defs);
    el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': op }, grad);
    el('stop', { offset: 0.55, 'stop-color': color, 'stop-opacity': op * 0.45 }, grad);
    el('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }, grad);
    var g = el('g', { filter: 'url(#' + id + ')' }, svg);
    var blobs = [
      { cx: 500, cy: 660, rx: 340, ry: 240 },
      { cx: 330, cy: 470, rx: 170, ry: 310 },
      { cx: 690, cy: 540, rx: 200, ry: 280 },
      { cx: 540, cy: 320, rx: 120, ry: 220 },
      { cx: 420, cy: 240, rx: 80, ry: 160 }
    ];
    blobs.forEach(function (bl) { el('ellipse', { cx: bl.cx, cy: bl.cy, rx: bl.rx, ry: bl.ry, fill: 'url(#' + id + 'g)' }, g); });
    if (!reduced && host.dataset.static !== 'true') {
      var t = 0;
      setInterval(function () {
        t += 0.08;
        flow.setAttribute('baseFrequency', (0.0028 + 0.0005 * Math.sin(t * 0.31)).toFixed(5) + ' ' + (0.0055 + 0.0008 * Math.cos(t * 0.23)).toFixed(5));
        g.setAttribute('transform', 'translate(' + (10 * Math.sin(t * 0.17)).toFixed(1) + ' ' + (-22 * Math.sin(t * 0.21)).toFixed(1) + ')');
      }, 80);
    }
    return svg;
  }

  function init(root) {
    (root || document).querySelectorAll('[data-geo]').forEach(function (host) {
      if (host.dataset.geoDone) return;
      host.dataset.geoDone = '1';
      var kind = host.dataset.geo;
      if (kind === 'chain') chain(host);
      else if (kind === 'spiral') spiral(host);
      else if (kind === 'golden-rect') goldenRect(host);
      else if (kind === 'eye') eye(host);
      else if (kind === 'smoke') smoke(host);
    });
  }

  window.EMAJANE = { PHI: PHI, chain: chain, spiral: spiral, goldenRect: goldenRect, eye: eye, smoke: smoke, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
