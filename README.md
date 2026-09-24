# CGIAR El Niño 2026 evidence explorer

Searchable map and list of CGIAR reports, tools, advisories and events on the 2026 El Niño. It is built to sit inside a CGIAR.org page as an iframe, so it has no header or footer.

Static HTML, CSS and JavaScript with no build step. The content comes from a public Google Sheet each time the page loads.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | The explorer (the page the iframe loads) |
| `assets/js/app.js` | Loads the sheet, filters, map, list and cards |
| `assets/js/places.js` | Pin positions for each country or region name |
| `assets/css/cgiar-ui.css` | CGIAR.org design system subset (tokens, `h-typo-*`, `a-button`, `a-link`, `a-tag`, `m-search-field`), copied from the production stylesheet; don't edit by hand |
| `assets/css/app.css` | App layout, using only design-system semantic tokens |
| `assets/icons.svg` | CGIAR icon sprite |
| `assets/data/countries.geojson` | Country outlines (Natural Earth 1:110m, public domain) |
| `embed.html` | Test page showing the iframe embed code |

## Run locally

No PHP or database is needed; any static file server works. From the project folder:

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765/> (or <http://localhost:8765/embed.html> to see it inside an iframe). Opening `index.html` straight from disk (`file://`) won't work, because the browser blocks loading the map outlines from a local file.

## Editing content

Edit the [Google Sheet](https://docs.google.com/spreadsheets/d/1jRSLLTN6pCHIy3XGOg4yHNHA1EZKNfDdbz2Jg9yBXOA/edit). Changes appear on the next page load, usually within a minute. The sheet must stay shared as "Anyone with the link can view".

Columns are matched by header name, so column order doesn't matter, and title rows above the header row are ignored. The app uses:

- **Title** and **Primary URL**: required; rows missing either are skipped
- **Date**: e.g. `11 Sep 2026`; the list sorts newest first
- **Centre or organization**: the Organization filter matches CGIAR centre names inside this text
- **Content group**: use one of the six types from the content structure document
- **Country or region**: a country, a region (`South Asia`, `Mexico and Central America`), `Maharashtra, India` (pins to India) or `Global` (no pin)
- **Proposed page text**: the description on the card
- **Primary link label**, **Optional second link label**, **Optional second URL**
- **Latitude** and **Longitude** (optional): add these columns to place a pin by hand

**Evidence note or limit** and **Owner decision** are internal columns and never shown. Every row with a title and URL is published. To hide a row, delete it or clear its Primary URL.

If a new place name has no pin, the browser console warns about it. Add it to `assets/js/places.js`, or fill Latitude and Longitude in the sheet.

## Embedding on CGIAR.org

Paste this into a Full HTML block, with `src` pointing to wherever the app is hosted:

```html
<iframe id="cgiar-elnino" src="https://YOUR-HOST/cgiar-el-nino/" title="El Niño 2026 evidence explorer"
  loading="lazy" style="display:block;width:100%;height:1400px;border:0;"></iframe>
<script>
  window.addEventListener('message', function (e) {
    var f = document.getElementById('cgiar-elnino');
    if (!f || e.source !== f.contentWindow) return;
    if (e.data && e.data.type === 'cgiar-elnino:height') f.style.height = e.data.height + 'px';
  });
</script>
```

The script resizes the iframe to fit its content, so there is no second scrollbar. Without it the iframe stays at 1400px and scrolls inside.

To open a pre-filtered view, add query parameters to the `src`: `?country=Malawi`, `?type=Tools, data and forecasts`, `?org=IWMI`, `?q=drought`, `?view=list`. Filters are multi-select, so a parameter can repeat: `?country=India&country=Malawi`. Point the `src` at the folder (`…/cgiar-el-nino/?country=Malawi`) rather than `index.html`, because some servers redirect `index.html` and drop the query.
