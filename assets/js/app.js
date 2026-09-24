(function () {
  'use strict';

  // Public Google Sheet that holds the content. Editors change the sheet;
  // the page picks the change up on the next load.
  var SHEET_ID = '1jRSLLTN6pCHIy3XGOg4yHNHA1EZKNfDdbz2Jg9yBXOA';
  var SHEET_GID = '978084512';
  var SHEET_CSV = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=' + SHEET_GID;

  // Content groups from the web content structure, in display order.
  var TYPES = [
    'Reports, plans and policy notes',
    'Tools, data and forecasts',
    'Advisories, bulletins and early warning',
    'Country preparedness and partner action',
    'Events, training and outreach',
    'Analysis, news and commentary'
  ];

  // Organization filter options. A row matches every option whose pattern
  // appears in its "Centre or organization" text.
  var ORGS = [
    { label: 'Alliance of Bioversity International and CIAT', re: /\bAlliance\b|\bCIAT\b|Bioversity/i },
    { label: 'AfricaRice', re: /AfricaRice/i },
    { label: 'CIFOR-ICRAF', re: /CIFOR|ICRAF/i },
    { label: 'CIMMYT', re: /\bCIMMYT\b/i },
    { label: 'CIP', re: /\bCIP\b|International Potato Center/i },
    { label: 'ICARDA', re: /\bICARDA\b/i },
    { label: 'ICRISAT', re: /\bICRISAT\b/i },
    { label: 'IFPRI', re: /\bIFPRI\b/i },
    { label: 'IITA', re: /\bIITA\b/i },
    { label: 'ILRI', re: /\bILRI\b/i },
    { label: 'IRRI', re: /\bIRRI\b/i },
    { label: 'IWMI', re: /\bIWMI\b/i },
    { label: 'WorldFish', re: /WorldFish/i },
    { label: 'CGIAR programs and joint work', re: /\bCGIAR\b/i }
  ];

  var GLOBAL = 'Global';
  var PLACES = window.ELNINO_PLACES || {};

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    form: $('controls'), search: $('search'), country: $('f-country'), type: $('f-type'), org: $('f-org'),
    count: $('count'), tabMap: $('tab-map'), tabList: $('tab-list'), paneMap: $('pane-map'), paneList: $('pane-list'),
    index: $('index'), resources: $('resources'), globalNote: $('global-note'), map: $('map')
  };

  var entries = [];
  var view = 'map';
  var map, markerLayer, countryLayer;

  /* ---------- Data ---------- */

  function parseCSV(text) {
    var rows = [], row = [], cell = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  var norm = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); };

  // The sheet has a title block above the table, so find the header row
  // by its column names instead of assuming row 1.
  function toRecords(rows) {
    var h = rows.findIndex(function (r) {
      var cells = r.map(norm);
      return cells.indexOf('title') > -1 && cells.indexOf('primary url') > -1;
    });
    if (h < 0) throw new Error('Header row not found in sheet');
    var head = rows[h].map(norm);
    return rows.slice(h + 1).map(function (r) {
      var o = {};
      head.forEach(function (k, i) { if (k) o[k] = (r[i] || '').trim(); });
      return o;
    });
  }

  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

  // Accepts "11 Sep 2026", "11 September 2026" and ISO "2026-09-11".
  // Built by hand because Safari rejects the day-month-year forms.
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parseDate(raw) {
    var m = String(raw || '').trim().match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})$/i);
    if (m && MONTHS.indexOf(m[2].toLowerCase()) > -1) return new Date(+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1]);
    m = String(raw || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN);
  }

  function locate(raw, lat, lng) {
    var value = String(raw || '').trim();
    if (!value || norm(value) === 'global') return { country: GLOBAL, pin: null, areas: [] };
    var parts = value.split(',');
    var last = parts[parts.length - 1].trim();
    var hit = PLACES[norm(value)] || PLACES[norm(last)];
    var country = (hit && hit.country) || (PLACES[norm(value)] ? value : last);
    var areas = (hit && hit.areas) || [country];
    var la = parseFloat(lat), ln = parseFloat(lng);
    if (!isNaN(la) && !isNaN(ln)) return { country: country, pin: { lat: la, lng: ln }, areas: areas };
    if (!hit) console.warn('[El Niño explorer] No map position for "' + value + '". Add it to assets/js/places.js or fill Latitude/Longitude in the sheet.');
    return { country: country, pin: hit ? { lat: hit.lat, lng: hit.lng } : null, areas: areas };
  }

  function toEntry(r, i) {
    var title = r['title'], url = safeUrl(r['primary url']);
    if (!title || !url) return null;
    var place = locate(r['country or region'], r['latitude'], r['longitude']);
    var date = parseDate(r['date']);
    var org = r['centre or organization'] || '';
    return {
      id: 'r' + (r['activity id'] || i).replace(/[^\w-]/g, '-'),
      title: title,
      org: org,
      orgs: ORGS.filter(function (o) { return o.re.test(org); }).map(function (o) { return o.label; }),
      type: r['content group'] || '',
      placeLabel: r['country or region'] || GLOBAL,
      country: place.country,
      pin: place.pin,
      areas: place.areas,
      time: isNaN(date) ? 0 : date.getTime(),
      date: isNaN(date) ? r['date'] : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      text: r['proposed page text'] || r['description'] || '',
      links: [
        { label: r['primary link label'] || 'Read more', url: url },
        { label: r['optional second link label'] || 'Read more', url: safeUrl(r['optional second url']) }
      ].filter(function (l) { return l.url; })
    };
  }

  function load() {
    el.count.textContent = 'Loading published work…';
    el.resources.innerHTML = '';
    return fetch(SHEET_CSV, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
      .then(function (text) {
        entries = toRecords(parseCSV(text)).map(toEntry).filter(Boolean)
          .sort(function (a, b) { return b.time - a.time; });
        buildOptions();
        readState();
        render();
        if (map) fitToPins();
      })
      .catch(function (err) {
        console.error('[El Niño explorer]', err);
        el.count.textContent = 'Published work could not be loaded.';
        el.resources.innerHTML = '<div class="notice"><p>We couldn’t reach the data source. Check your connection and try again.</p><button type="button" class="button" id="retry">Try again</button></div>';
        $('retry').addEventListener('click', load);
        postHeight();
      });
  }

  /* ---------- Filters ---------- */

  function fillSelect(select, values) {
    select.length = 1;
    values.forEach(function (v) { select.add(new Option(v, v)); });
  }

  function uniq(list) { return list.filter(function (v, i) { return v && list.indexOf(v) === i; }); }

  function buildOptions() {
    var countries = uniq(entries.map(function (e) { return e.country; })).filter(function (c) { return c !== GLOBAL; }).sort();
    if (entries.some(function (e) { return e.country === GLOBAL; })) countries.push(GLOBAL);
    fillSelect(el.country, countries);

    var types = uniq(entries.map(function (e) { return e.type; }));
    fillSelect(el.type, TYPES.filter(function (t) { return types.indexOf(t) > -1; })
      .concat(types.filter(function (t) { return TYPES.indexOf(t) < 0; })));

    var orgs = uniq([].concat.apply([], entries.map(function (e) { return e.orgs; })));
    fillSelect(el.org, ORGS.map(function (o) { return o.label; }).filter(function (l) { return orgs.indexOf(l) > -1; }));
  }

  function matching() {
    var q = norm(el.search.value), c = el.country.value, t = el.type.value, o = el.org.value;
    return entries.filter(function (e) {
      return (!c || e.country === c) &&
        (!t || e.type === t) &&
        (!o || e.orgs.indexOf(o) > -1) &&
        (!q || norm([e.title, e.org, e.type, e.text, e.placeLabel].join(' ')).indexOf(q) > -1);
    });
  }

  // Filters live in the query string so CGIAR.org can embed a pre-filtered
  // view, e.g. index.html?country=Malawi&view=list
  function readState() {
    var p = new URLSearchParams(location.search);
    el.search.value = p.get('q') || '';
    [['country', el.country], ['type', el.type], ['org', el.org]].forEach(function (pair) {
      var v = p.get(pair[0]);
      if (v && Array.prototype.some.call(pair[1].options, function (opt) { return opt.value === v; })) pair[1].value = v;
    });
    setView(p.get('view') === 'list' ? 'list' : 'map', false);
  }

  function writeState() {
    var p = new URLSearchParams();
    if (el.search.value.trim()) p.set('q', el.search.value.trim());
    if (el.country.value) p.set('country', el.country.value);
    if (el.type.value) p.set('type', el.type.value);
    if (el.org.value) p.set('org', el.org.value);
    if (view === 'list') p.set('view', 'list');
    var qs = p.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) { /* sandboxed iframe */ }
  }

  /* ---------- Rendering ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  function render() {
    var shown = matching();
    var pinned = shown.filter(function (e) { return e.pin; });
    var global = shown.filter(function (e) { return e.country === GLOBAL; });
    var places = uniq(pinned.map(function (e) { return e.country; }));

    el.count.innerHTML = shown.length
      ? '<strong>' + plural(shown.length, 'resource', 'resources') + '</strong> · ' + plural(places.length, 'place', 'places') + ' on the map'
      : '<strong>No resources</strong> match these filters';

    if (global.length && view === 'map') {
      el.globalNote.hidden = false;
      el.globalNote.innerHTML = plural(global.length, 'global resource is', 'global resources are') +
        ' not tied to one place. ' + (el.country.value === GLOBAL ? '' : '<button type="button" class="link" data-country="Global">Show global resources</button>');
    } else {
      el.globalNote.hidden = true;
    }

    el.resources.innerHTML = shown.length ? shown.map(card).join('') : emptyState();
    el.index.innerHTML = shown.length ? indexList(shown) : emptyState();
    drawMarkers(pinned);
    writeState();
    postHeight();
  }

  function card(e) {
    return '<article class="resource" id="' + e.id + '" tabindex="-1">' +
      '<p class="tags"><span class="tag tag-place">' + esc(e.placeLabel) + '</span>' +
      (e.type ? '<span class="tag">' + esc(e.type) + '</span>' : '') + '</p>' +
      '<h3>' + esc(e.title) + '</h3>' +
      '<p class="meta">' + esc(e.org) + (e.date ? ' <span aria-hidden="true">·</span> <time>' + esc(e.date) + '</time>' : '') + '</p>' +
      (e.text ? '<p class="text">' + esc(e.text) + '</p>' : '') +
      '<p class="actions">' + e.links.map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) +
          '<span class="visually-hidden"> (opens in a new tab)</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg></a>';
      }).join('') + '</p>' +
    '</article>';
  }

  function indexList(shown) {
    var groups = uniq(shown.map(function (e) { return e.country; })).sort(function (a, b) {
      return (a === GLOBAL) - (b === GLOBAL) || a.localeCompare(b);
    });
    return groups.map(function (g) {
      var rows = shown.filter(function (e) { return e.country === g; });
      return '<div class="group"><h3>' + esc(g === GLOBAL ? 'Global resources' : g) + ' <span>' + rows.length + '</span></h3><ul>' +
        rows.map(function (e) {
          return '<li><span class="row-title">' + esc(e.title) + '</span><span class="row-meta">' + esc(e.type) + '</span>' +
            '<time class="row-date">' + esc(e.date) + '</time><button type="button" class="link" data-goto="' + e.id + '">View details</button></li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function emptyState() {
    return '<div class="notice"><p>No published resources match these filters.</p><button type="button" class="button" data-reset>Reset filters</button></div>';
  }

  /* ---------- Map ---------- */

  function initMap() {
    if (!window.L) {
      el.map.innerHTML = '<p class="notice">The map could not load. Use the List view to explore the same resources.</p>';
      return;
    }
    map = L.map(el.map, {
      scrollWheelZoom: false, zoomControl: false, minZoom: 1, maxZoom: 6, zoomSnap: 0.25,
      maxBounds: [[-70, -200], [88, 200]], maxBoundsViscosity: 0.8
    }).setView([12, 20], 2);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution('Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>');

    // Country outlines are bundled locally (no tile service or API key).
    countryLayer = L.geoJSON(null, { style: countryStyle, interactive: false }).addTo(map);
    fetch('assets/data/countries.geojson')
      .then(function (res) { return res.json(); })
      .then(function (data) { countryLayer.addData(data); countryLayer.setStyle(countryStyle); })
      .catch(function (err) { console.error('[El Niño explorer] Country outlines', err); });

    markerLayer = L.featureGroup().addTo(map);
    map.on('zoomend', spreadPins);
    // Let the page scroll past the map; zoom with the wheel only after a click.
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });
  }

  var shaded = {};
  function countryStyle(f) {
    var on = shaded[f.properties.name];
    return { color: '#fff', weight: 0.8, fillColor: on ? '#7fd9c1' : '#d9dfdd', fillOpacity: 1 };
  }

  function drawMarkers(pinned) {
    if (!map) return;
    shaded = {};
    pinned.forEach(function (e) { e.areas.forEach(function (a) { shaded[a] = true; }); });
    countryLayer.setStyle(countryStyle);
    markerLayer.clearLayers();
    var byPlace = {};
    pinned.forEach(function (e) { (byPlace[e.country] = byPlace[e.country] || { pin: e.pin, items: [] }).items.push(e); });
    Object.keys(byPlace).forEach(function (name) {
      var g = byPlace[name], n = g.items.length;
      var marker = L.marker([g.pin.lat, g.pin.lng], {
        title: name + ': ' + plural(n, 'resource', 'resources'),
        alt: name,
        riseOnHover: true,
        icon: L.divIcon({ className: 'pin', html: '<span>' + n + '</span>', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] })
      });
      marker.bindPopup(
        '<p class="popup-place">' + esc(name) + '</p><p class="popup-count">' + plural(n, 'published resource', 'published resources') + '</p><ul class="popup-list">' +
        g.items.map(function (e) {
          return '<li><span class="popup-type">' + esc(e.type) + '</span>' + esc(e.title) +
            '<button type="button" class="link" data-goto="' + e.id + '">View details</button></li>';
        }).join('') + '</ul>',
        { maxWidth: 300, minWidth: 240, autoPanPadding: [24, 24] }
      );
      marker.home = L.latLng(g.pin.lat, g.pin.lng);
      marker.addTo(markerLayer);
    });
    spreadPins();
  }

  // Pins for neighbouring places (India and South Asia) sit on top of each
  // other at world zoom, so nudge any pin that lands within one pin width
  // of an earlier one. Recomputed on every zoom.
  var PIN_GAP = 44;
  function spreadPins() {
    var placed = [];
    markerLayer.eachLayer(function (m) {
      var p = map.latLngToLayerPoint(m.home);
      for (var tries = 0; tries < 8; tries++) {
        var clash = placed.find(function (q) { return q.distanceTo(p) < PIN_GAP; });
        if (!clash) break;
        var dx = p.x - clash.x, dy = p.y - clash.y, len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) { dx = 1; dy = 0; len = 1; }
        p = L.point(clash.x + dx / len * PIN_GAP, clash.y + dy / len * PIN_GAP);
      }
      placed.push(p);
      m.setLatLng(map.layerPointToLatLng(p));
    });
  }

  function fitToPins() {
    if (!map) return;
    var bounds = L.latLngBounds([]);
    markerLayer.eachLayer(function (m) { bounds.extend(m.home); });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: el.map.clientWidth < 600 ? [24, 24] : [60, 60], maxZoom: 4 });
    else map.setView([12, 20], 2);
  }

  /* ---------- View switching ---------- */

  function setView(next, update) {
    view = next;
    var isMap = next === 'map';
    el.paneMap.hidden = !isMap;
    el.paneList.hidden = isMap;
    el.tabMap.setAttribute('aria-selected', String(isMap));
    el.tabList.setAttribute('aria-selected', String(!isMap));
    el.tabMap.tabIndex = isMap ? 0 : -1;
    el.tabList.tabIndex = isMap ? -1 : 0;
    if (isMap && map) requestAnimationFrame(function () { map.invalidateSize(); });
    if (update !== false) render();
  }

  function goTo(id) {
    var target = $(id);
    if (!target) return;
    if (map) map.closePopup();
    target.classList.remove('is-target');
    void target.offsetWidth;
    target.classList.add('is-target');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }

  /* ---------- iframe height ---------- */

  // When embedded, tell the parent page how tall the content is so the
  // iframe can grow with it instead of scrolling. See embed.html.
  var lastHeight = 0;
  function postHeight() {
    if (window.parent === window) return;
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === lastHeight) return;
    lastHeight = h;
    window.parent.postMessage({ type: 'cgiar-elnino:height', height: h }, '*');
  }

  /* ---------- Events ---------- */

  var searchTimer;
  el.search.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(render, 150); });
  [el.country, el.type, el.org].forEach(function (s) { s.addEventListener('change', function () { render(); fitToPins(); }); });
  el.form.addEventListener('submit', function (ev) { ev.preventDefault(); });
  el.form.addEventListener('reset', function () { setTimeout(function () { render(); fitToPins(); }); });

  el.tabMap.addEventListener('click', function () { setView('map'); });
  el.tabList.addEventListener('click', function () { setView('list'); });
  el.tabMap.parentNode.addEventListener('keydown', function (ev) {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    var next = view === 'map' ? 'list' : 'map';
    setView(next);
    (next === 'map' ? el.tabMap : el.tabList).focus();
  });

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-goto],[data-country],[data-reset]');
    if (!t) return;
    if (t.hasAttribute('data-goto')) goTo(t.getAttribute('data-goto'));
    else if (t.hasAttribute('data-reset')) el.form.reset();
    else { el.country.value = t.getAttribute('data-country'); setView('list'); }
  });

  if ('ResizeObserver' in window) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener('load', postHeight);

  initMap();
  load();
})();
