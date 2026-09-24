# CGIAR El Niño 2026 evidence explorer

Searchable map and list of CGIAR reports, tools, advisories and events on the 2026 El Niño. It is built to sit inside a CGIAR.org page as an iframe, so it has no header or footer.

Static HTML, CSS and JavaScript with no build step. The content comes from a public Google Sheet each time the page loads.

**Live:** <https://cg-so.github.io/cgiar-el-nino/> · embed test: <https://cg-so.github.io/cgiar-el-nino/embed.html>

## Hosting

GitHub Pages serves the `main` branch (root folder). Every push to `main` goes live within a minute or two. Content changes in the Google Sheet need no deploy.

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

## Managing content

Content lives in two Google Sheets:

| Sheet | Who sees it | Purpose |
| --- | --- | --- |
| **Working sheet** ([link](https://docs.google.com/spreadsheets/d/1jRSLLTN6pCHIy3XGOg4yHNHA1EZKNfDdbz2Jg9yBXOA/edit), tab `First batch`) | Private: the editors only | Where entries are written, checked and approved. Holds internal columns (evidence notes, owner decisions). |
| **Public sheet** | Anyone with the link (read-only) | A formula copies in only the approved rows and only the columns the page shows. The page reads this sheet. Nobody edits it by hand. |

### Publishing workflow

1. Add or edit the row in the working sheet.
2. When it's ready, set **Publish** to `Yes`.
3. The row appears on the page within about a minute. Set **Publish** back to `No` (or leave it blank) to take it down.

### One-time setup

1. **Working sheet:** add a column **Publish** after *Owner decision* (column O, header in row 5). Give it a Yes/No dropdown: select the column, then *Data → Data validation → Dropdown*.
2. **Public sheet:** create a new, empty Google Sheet (e.g. "El Niño 2026 explorer – public data").
   - In **A1** (header row):
     ```
     =CHOOSECOLS(IMPORTRANGE("1jRSLLTN6pCHIy3XGOg4yHNHA1EZKNfDdbz2Jg9yBXOA","First batch!A5:O5"),2,3,4,5,6,7,8,9,10,11,12,15)
     ```
   - In **A2** (published rows):
     ```
     =IFERROR(CHOOSECOLS(FILTER(IMPORTRANGE("1jRSLLTN6pCHIy3XGOg4yHNHA1EZKNfDdbz2Jg9yBXOA","First batch!A6:O"),IMPORTRANGE("1jRSLLTN6pCHIy3XGOg4yHNHA1EZKNfDdbz2Jg9yBXOA","First batch!O6:O")="Yes"),2,3,4,5,6,7,8,9,10,11,12,15),"")
     ```
   - Click **Allow access** when Sheets asks to connect the two files.
   - Share it as *Anyone with the link → Viewer*.
3. **Point the page at the public sheet:** set `SHEET_ID` and `SHEET_GID` at the top of `assets/js/app.js` to the public sheet's ID and tab `gid` (both are in its URL), then push.
4. **Make the working sheet private:** *Share → General access → Restricted*. Do this only after step 3 is live, or the page will stop loading.

The numbers in the formulas pick columns B–L (Activity ID to Optional second URL) and O (Publish), and leave out *Order*, *Evidence note or limit* and *Owner decision*. If you add columns later (for example Latitude and Longitude), widen `A5:O5`, `A6:O` and `O6:O` and add their numbers.

The page also checks the Publish column itself: rows whose Publish value isn't `Yes`, `Y`, `True`, `X`, `Approved` or `Published` are never shown, even if they reach the public sheet. If a sheet has no Publish column, every complete row is shown.

### Column rules

Columns are matched by header name, so column order doesn't matter, and title rows above the header row are ignored. The app uses:

- **Title** and **Primary URL**: required; rows missing either are skipped
- **Date**: e.g. `11 Sep 2026`; the list sorts newest first
- **Centre or organization**: the Organization filter matches CGIAR centre names inside this text
- **Content group**: use one of the six types from the content structure document
- **Country or region**: a country, a region (`South Asia`, `Mexico and Central America`), `Maharashtra, India` (pins to India) or `Global` (no pin)
- **Proposed page text**: the description on the card
- **Primary link label**, **Optional second link label**, **Optional second URL**
- **Publish**: see above
- **Latitude** and **Longitude** (optional): add these columns to place a pin by hand

If a new place name has no pin, the browser console warns about it. Add it to `assets/js/places.js`, or fill Latitude and Longitude in the sheet.

## Embedding on CGIAR.org

Paste this into a Full HTML block:

```html
<iframe id="cgiar-elnino" src="https://cg-so.github.io/cgiar-el-nino/" title="El Niño 2026 evidence explorer"
  loading="lazy" style="display:block;width:100%;height:1400px;border:0;"></iframe>
<script>
  window.addEventListener('message', function (e) {
    var f = document.getElementById('cgiar-elnino');
    if (!f || e.source !== f.contentWindow) return;
    if (e.data && e.data.type === 'cgiar-elnino:height') f.style.height = e.data.height + 'px';
  });
</script>
```

The page has no outer padding and a transparent background, so it sits flush inside a CGIAR.org grid cell; the cell provides the spacing and background. The script resizes the iframe to fit its content, so there is no second scrollbar. Without it (for example, if the Drupal text format strips `<script>` tags) the iframe stays at 1400px and scrolls inside.

To open a pre-filtered view, add query parameters to the `src`: `?country=Malawi`, `?type=Tools, data and forecasts`, `?org=IWMI`, `?q=drought`, `?view=list`. Filters are multi-select, so a parameter can repeat: `?country=India&country=Malawi`. Point the `src` at the folder (`https://cg-so.github.io/cgiar-el-nino/?country=Malawi`) rather than `index.html`, because some servers redirect `index.html` and drop the query.
