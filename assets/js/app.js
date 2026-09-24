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
    form: $('controls'), search: $('search'), groups: $('filter-groups'), tags: $('filter-tags'), resetAll: $('reset-all'),
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
        el.resources.innerHTML = '<div class="notice h-typo-copy-m"><p>We couldn’t reach the data source. Check your connection and try again.</p>' + button('Try again', 'id="retry"') + '</div>';
        $('retry').addEventListener('click', load);
        postHeight();
      });
  }

  /* ---------- Filters ---------- */

  // Multi-select filter groups in the cgiar.org/publications style
  // (cms-search-filter). Ticking boxes only changes the draft; "Apply filters"
  // commits it to `selected`, which drives the results.
  var GROUPS = [
    { key: 'country', label: 'Country or region' },
    { key: 'type', label: 'Type of work' },
    { key: 'org', label: 'Organization' }
  ];
  var options = { country: [], type: [], org: [] };
  var selected = { country: [], type: [], org: [] };

  function uniq(list) { return list.filter(function (v, i) { return v && list.indexOf(v) === i; }); }

  function buildOptions() {
    var countries = uniq(entries.map(function (e) { return e.country; })).filter(function (c) { return c !== GLOBAL; }).sort();
    if (entries.some(function (e) { return e.country === GLOBAL; })) countries.push(GLOBAL);
    options.country = countries;

    var types = uniq(entries.map(function (e) { return e.type; }));
    options.type = TYPES.filter(function (t) { return types.indexOf(t) > -1; })
      .concat(types.filter(function (t) { return TYPES.indexOf(t) < 0; }));

    var orgs = uniq([].concat.apply([], entries.map(function (e) { return e.orgs; })));
    options.org = ORGS.map(function (o) { return o.label; }).filter(function (l) { return orgs.indexOf(l) > -1; });

    el.groups.innerHTML = GROUPS.map(groupHtml).join('');
  }

  function groupHtml(g) {
    var id = 'filter-' + g.key;
    return '<div class="cms-search-filter-group" data-group="' + g.key + '">' +
      '<button type="button" class="cms-search-filter-link h-typo-link" aria-expanded="false" aria-controls="' + id + '">' +
        '<span class="cms-search-filter-link__wrapper"><span class="cms-search-filter-link__text">' + esc(g.label) + '</span>' +
        '<span class="cms-search-filter-link__counter"></span></span>' +
        '<span class="cms-search-filter-link__icon">' + icon('arrow-down') + '</span>' +
      '</button>' +
      '<div class="filter-dropdown" id="' + id + '" hidden>' +
        '<div class="cms-search-filter-group__dropdown">' +
          '<div class="cms-search-filter-group__action">' +
            '<button class="cms-search-filter-group__select-all h-typo-copy-xs" type="button" data-select-all>Select all</button>' +
            '<button class="cms-search-filter-group__reset h-typo-copy-xs" type="button" data-clear>Reset</button>' +
          '</div>' +
          '<div class="cms-search-filter-group__content">' +
            (options[g.key].length > 6 ? '<div class="cms-search-filter-group__search"><input class="cms-search-filter-group__search-input h-typo-copy-s" type="text" placeholder="Search" aria-label="Search ' + esc(g.label.toLowerCase()) + ' options"></div>' : '') +
            '<ul class="cms-search-filter-group__list">' + options[g.key].map(function (v) {
              return '<li class="cms-search-filter-group__item" data-filtertext="' + esc(v.toLowerCase()) + '"><label class="cms-search-filter-group__label">' +
                '<input class="cms-search-filter-group__checkbox" type="checkbox" value="' + esc(v) + '">' +
                '<span class="cms-search-filter-group__text h-typo-link-s">' + esc(v === GLOBAL ? 'Global resources' : v) + '</span></label></li>';
            }).join('') + '</ul>' +
            '<p class="cms-search-filter-group__no-results h-typo-copy-xs" hidden>No matches found</p>' +
            '<div class="cms-search-filter-group__btn"><button class="cms-search-filter-group__btn-submit h-typo-link-s" type="button" data-apply>Apply filters</button></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function groupEl(key) { return el.groups.querySelector('[data-group="' + key + '"]'); }

  function openGroup(key) {
    closeGroups();
    var g = groupEl(key);
    g.querySelectorAll('.cms-search-filter-group__checkbox').forEach(function (cb) { cb.checked = selected[key].indexOf(cb.value) > -1; });
    var search = g.querySelector('.cms-search-filter-group__search-input');
    if (search) { search.value = ''; filterOptions(g, ''); }
    g.querySelector('.cms-search-filter-link').setAttribute('aria-expanded', 'true');
    g.querySelector('.filter-dropdown').hidden = false;
    postHeight();
  }

  function closeGroups() {
    el.groups.querySelectorAll('.cms-search-filter-group').forEach(function (g) {
      g.querySelector('.cms-search-filter-link').setAttribute('aria-expanded', 'false');
      g.querySelector('.filter-dropdown').hidden = true;
    });
  }

  function filterOptions(g, q) {
    q = norm(q);
    var shown = 0;
    g.querySelectorAll('.cms-search-filter-group__item').forEach(function (li) {
      li.hidden = q && li.getAttribute('data-filtertext').indexOf(q) < 0;
      if (!li.hidden) shown++;
    });
    g.querySelector('.cms-search-filter-group__no-results').hidden = shown > 0;
  }

  function applyGroup(key) {
    var g = groupEl(key);
    selected[key] = Array.prototype.filter.call(g.querySelectorAll('.cms-search-filter-group__checkbox'), function (cb) { return cb.checked; })
      .map(function (cb) { return cb.value; });
    closeGroups();
    render();
    fitToPins();
  }

  function setFilter(key, values) {
    selected[key] = values.slice();
    render();
    fitToPins();
  }

  function resetAll() {
    el.search.value = '';
    GROUPS.forEach(function (g) { selected[g.key] = []; });
    closeGroups();
    render();
    fitToPins();
  }

  function drawFilterState() {
    GROUPS.forEach(function (g) {
      var n = selected[g.key].length;
      var counter = groupEl(g.key).querySelector('.cms-search-filter-link__counter');
      counter.textContent = n || '';
      counter.style.display = n ? 'inline-block' : '';
    });
    el.tags.innerHTML = [].concat.apply([], GROUPS.map(function (g) {
      return selected[g.key].map(function (v) {
        return '<button type="button" class="h-typo-tag" data-untag="' + g.key + '" data-value="' + esc(v) + '" aria-label="Remove filter: ' + esc(v) + '">' +
          esc(v === GLOBAL ? 'Global resources' : v) + '<svg aria-hidden="true"><use href="assets/icons.svg#close"></use></svg></button>';
      });
    })).join('');
    el.tags.hidden = !el.tags.innerHTML;
  }

  function matching() {
    var q = norm(el.search.value), c = selected.country, t = selected.type, o = selected.org;
    return entries.filter(function (e) {
      return (!c.length || c.indexOf(e.country) > -1) &&
        (!t.length || t.indexOf(e.type) > -1) &&
        (!o.length || e.orgs.some(function (x) { return o.indexOf(x) > -1; })) &&
        (!q || norm([e.title, e.org, e.type, e.text, e.placeLabel].join(' ')).indexOf(q) > -1);
    });
  }

  // Filters live in the query string so CGIAR.org can embed a pre-filtered
  // view, e.g. index.html?country=Malawi&country=India&view=list
  function readState() {
    var p = new URLSearchParams(location.search);
    el.search.value = p.get('q') || '';
    GROUPS.forEach(function (g) {
      selected[g.key] = p.getAll(g.key).filter(function (v) { return options[g.key].indexOf(v) > -1; });
    });
    setView(p.get('view') === 'list' ? 'list' : 'map', false);
  }

  function writeState() {
    var p = new URLSearchParams();
    if (el.search.value.trim()) p.set('q', el.search.value.trim());
    GROUPS.forEach(function (g) { selected[g.key].forEach(function (v) { p.append(g.key, v); }); });
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

  // Markup helpers for CGIAR design-system components (see cgiar-ui.css).
  function icon(name) {
    return '<svg class="a-icon" aria-hidden="true"><use href="assets/icons.svg#' + name + '"></use></svg>';
  }
  function detailLink(id) {
    return '<button type="button" class="a-link a-link--right a-link--small h-typo-link-s link-button" data-goto="' + id + '">' +
      '<span class="a-link__text">View details</span><span class="a-link__icon">' + icon('arrow-long-right') + '</span></button>';
  }
  function button(label, attrs) {
    return '<button type="button" class="a-button a-button--primary a-button--size-small h-typo-link-s" ' + attrs + '>' +
      '<span class="a-button__text">' + label + '</span></button>';
  }

  function render() {
    var shown = matching();
    var pinned = shown.filter(function (e) { return e.pin; });
    var global = shown.filter(function (e) { return e.country === GLOBAL; });
    var places = uniq(pinned.map(function (e) { return e.country; }));

    el.count.innerHTML = shown.length
      ? '<strong>' + plural(shown.length, 'resource', 'resources') + '</strong> · ' + plural(places.length, 'place', 'places') + ' on the map'
      : '<strong>No resources</strong> match these filters';

    drawFilterState();

    if (global.length && view === 'map') {
      el.globalNote.hidden = false;
      el.globalNote.innerHTML = '<span>' + plural(global.length, 'global resource is', 'global resources are') + ' not tied to one place.</span>' +
        (selected.country.length === 1 && selected.country[0] === GLOBAL ? '' : '<button type="button" class="a-link a-link--right a-link--small h-typo-link-s link-button" data-country="Global">' +
          '<span class="a-link__text">Show global resources</span><span class="a-link__icon">' + icon('arrow-long-right') + '</span></button>');
    } else {
      el.globalNote.hidden = true;
    }

    el.resources.innerHTML = shown.length
      ? '<ul class="cms-search-result__items cms-search-result__items--grid-1">' + shown.map(card).join('') + '</ul>'
      : emptyState();
    el.index.innerHTML = shown.length ? indexList(shown) : emptyState();
    drawMarkers(pinned);
    writeState();
    postHeight();
  }

  // Result card in the cgiar.org/governance style (m-result). The whole card
  // opens the primary link; an optional second link sits in the tag row.
  function card(e) {
    var primary = e.links[0], second = e.links[1];
    var newTab = '<span class="visually-hidden"> (opens in a new tab)</span>';
    return '<li class="m-result" id="' + e.id + '" tabindex="-1">' +
      '<div class="m-result__link"><article class="m-result__article">' +
        (e.type ? '<div class="m-result__meta"><span class="h-typo-copy-xs-2">' + esc(e.type) + '</span></div><div class="h-s2"></div>' : '') +
        '<div class="m-result__headline"><h3 class="h-typo-headline-xs">' +
          '<a class="m-result__primary" href="' + esc(primary.url) + '" target="_blank" rel="noopener noreferrer">' + esc(e.title) + newTab + '</a>' +
        '</h3></div>' +
        '<div class="h-s2"></div>' +
        '<div class="m-result__captions">' +
          (e.date ? caption('calendar', '<time>' + esc(e.date) + '</time>') : '') +
          (e.org ? caption('account', esc(e.org)) : '') +
        '</div>' +
        (e.text ? '<div class="h-s3"></div><div class="m-result__text"><p class="h-typo-copy-m">' + esc(e.text) + '</p></div>' : '') +
        '<div class="h-s6"></div>' +
        '<div class="m-result__controls">' +
          '<div class="m-result__tags">' +
            '<div class="a-tag"><span class="h-typo-tag">' + esc(e.placeLabel) + '</span></div>' +
            (second ? '<a class="a-link a-link--right a-link--small h-typo-link-s m-result__second" href="' + esc(second.url) + '" target="_blank" rel="noopener noreferrer">' +
              '<span class="a-link__text">' + esc(second.label) + newTab + '</span><span class="a-link__icon">' + icon('external-link') + '</span></a>' : '') +
          '</div>' +
          '<div class="m-result__icon">' + icon('external-link') + '</div>' +
        '</div>' +
      '</article></div>' +
    '</li>';
  }

  function caption(name, html) {
    return '<div class="m-result__caption"><span class="m-result__caption-icon">' + icon(name) + '</span><span class="h-typo-copy-xs">' + html + '</span></div>';
  }

  function indexList(shown) {
    var groups = uniq(shown.map(function (e) { return e.country; })).sort(function (a, b) {
      return (a === GLOBAL) - (b === GLOBAL) || a.localeCompare(b);
    });
    return groups.map(function (g) {
      var rows = shown.filter(function (e) { return e.country === g; });
      return '<div class="group"><h3 class="group__title h-typo-headline-xs">' + esc(g === GLOBAL ? 'Global resources' : g) +
        ' <span class="group__count h-typo-copy-s">' + rows.length + '</span></h3><ul class="group__list">' +
        rows.map(function (e) {
          return '<li class="group__row"><span class="group__row-title h-typo-copy-m-2">' + esc(e.title) + '</span>' +
            '<span class="group__row-meta h-typo-copy-s">' + esc(e.type) + '</span>' +
            '<time class="group__row-meta h-typo-copy-s">' + esc(e.date) + '</time>' + detailLink(e.id) + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function emptyState() {
    return '<div class="notice h-typo-copy-m"><p>No published resources match these filters.</p>' + button('Reset filters', 'data-reset') + '</div>';
  }

  /* ---------- Map ---------- */

  function initMap() {
    if (!window.L) {
      el.map.innerHTML = '<p class="notice h-typo-copy-m">The map could not load. Use the List view to explore the same resources.</p>';
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

  // Country colors come from the --color-map-* tokens on .map-frame (app.css).
  var shaded = {}, mapColors;
  function token(name) { return getComputedStyle(el.map).getPropertyValue(name).trim(); }
  function countryStyle(f) {
    mapColors = mapColors || {
      active: token('--color-map-shaded'),
      inactive: token('--color-map-land'),
      line: token('--color-map-coast')
    };
    var on = shaded[f.properties.name];
    return { color: mapColors.line, weight: 0.8, fillColor: on ? mapColors.active : mapColors.inactive, fillOpacity: 1 };
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
        icon: L.divIcon({ className: 'pin', html: '<span>' + n + '</span>', iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -18] })
      });
      marker.bindPopup(
        '<div><p class="popup__place h-typo-headline-xs">' + esc(name) + '</p>' +
        '<p class="popup__count h-typo-caption">' + plural(n, 'published resource', 'published resources') + '</p><ul class="popup__list">' +
        g.items.map(function (e) {
          return '<li><span class="popup__type h-typo-tag">' + esc(e.type) + '</span><p class="popup__title h-typo-copy-s">' + esc(e.title) + '</p>' +
            detailLink(e.id) + '</li>';
        }).join('') + '</ul></div>',
        { maxWidth: 300, minWidth: 240, autoPanPadding: [24, 24] }
      );
      marker.on('popupopen', function () { L.DomUtil.addClass(marker.getElement(), 'is-active'); });
      marker.on('popupclose', function () { var m = marker.getElement(); if (m) L.DomUtil.removeClass(m, 'is-active'); });
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
  el.form.addEventListener('submit', function (ev) { ev.preventDefault(); });
  el.resetAll.addEventListener('click', resetAll);

  el.groups.addEventListener('click', function (ev) {
    var g = ev.target.closest('.cms-search-filter-group');
    if (!g) return;
    var key = g.getAttribute('data-group');
    if (ev.target.closest('.cms-search-filter-link')) {
      if (g.querySelector('.filter-dropdown').hidden) openGroup(key); else closeGroups();
    } else if (ev.target.closest('[data-apply]')) {
      applyGroup(key);
    } else if (ev.target.closest('[data-select-all],[data-clear]')) {
      var on = !!ev.target.closest('[data-select-all]');
      g.querySelectorAll('.cms-search-filter-group__item:not([hidden]) .cms-search-filter-group__checkbox').forEach(function (cb) { cb.checked = on; });
    }
  });
  el.groups.addEventListener('input', function (ev) {
    if (ev.target.matches('.cms-search-filter-group__search-input')) filterOptions(ev.target.closest('.cms-search-filter-group'), ev.target.value);
  });
  el.tags.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-untag]');
    if (!t) return;
    var key = t.getAttribute('data-untag'), v = t.getAttribute('data-value');
    setFilter(key, selected[key].filter(function (x) { return x !== v; }));
  });
  // Close an open dropdown on outside click or Escape, discarding unapplied ticks.
  document.addEventListener('click', function (ev) { if (!ev.target.closest('.cms-search-filter-group')) closeGroups(); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var open = el.groups.querySelector('.cms-search-filter-link[aria-expanded="true"]');
    closeGroups();
    if (open) open.focus();
  });

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
    else if (t.hasAttribute('data-reset')) resetAll();
    else { selected.country = [t.getAttribute('data-country')]; setView('list'); }
  });

  if ('ResizeObserver' in window) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener('load', postHeight);

  initMap();
  load();
})();
