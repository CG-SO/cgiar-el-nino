/*
 * Pin positions for the "Country or region" column.
 *
 * Keys are lower-case. A sheet value is matched in full first
 * ("mexico and central america"), then by its last comma-separated part
 * ("Maharashtra, India" -> "india"), so sub-national rows fall back to
 * their country. Rows marked "Global" are never pinned.
 *
 * A row can override its pin by filling optional "Latitude" and
 * "Longitude" columns in the sheet.
 *
 * `country` is the value used by the Country or region filter.
 * `areas` lists the country outlines (names as in assets/data/countries.geojson)
 * to shade; it defaults to the country itself.
 */
window.ELNINO_PLACES = {
  // Regions
  'south asia': { lat: 22.5, lng: 80.5, country: 'South Asia', areas: ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Bhutan', 'Afghanistan'] },
  'southeast asia': { lat: 7.5, lng: 107, country: 'Southeast Asia' },
  'east africa': { lat: 3, lng: 38, country: 'East Africa', areas: ['Ethiopia', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi', 'Somalia', 'S. Sudan'] },
  'eastern africa': { lat: 3, lng: 38, country: 'East Africa', areas: ['Ethiopia', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi', 'Somalia', 'S. Sudan'] },
  'southern africa': { lat: -20, lng: 27, country: 'Southern Africa', areas: ['South Africa', 'Namibia', 'Botswana', 'Zimbabwe', 'Zambia', 'Malawi', 'Mozambique', 'Lesotho', 'eSwatini', 'Madagascar', 'Angola'] },
  'west africa': { lat: 12, lng: -3, country: 'West Africa' },
  'sahel': { lat: 14.5, lng: 2, country: 'Sahel' },
  'horn of africa': { lat: 7, lng: 44, country: 'Horn of Africa', areas: ['Ethiopia', 'Somalia', 'Somaliland', 'Eritrea', 'Djibouti', 'Kenya'] },
  'central america': { lat: 14.6, lng: -87, country: 'Central America', areas: ['Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama'] },
  'mexico and central america': { lat: 16.5, lng: -92, country: 'Mexico and Central America', areas: ['Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama'] },
  'latin america': { lat: -8, lng: -62, country: 'Latin America' },
  'andes': { lat: -12, lng: -75, country: 'Andes' },
  'pacific': { lat: -10, lng: 165, country: 'Pacific' },

  // Countries
  'afghanistan': { lat: 33.9, lng: 67.7 },
  'bangladesh': { lat: 23.7, lng: 90.4 },
  'bhutan': { lat: 27.5, lng: 90.4 },
  'bolivia': { lat: -16.3, lng: -63.6 },
  'brazil': { lat: -10.8, lng: -52.9 },
  'burkina faso': { lat: 12.2, lng: -1.6 },
  'burundi': { lat: -3.4, lng: 29.9 },
  'cambodia': { lat: 12.6, lng: 104.9 },
  'cameroon': { lat: 7.4, lng: 12.4 },
  'chad': { lat: 15.5, lng: 18.7 },
  'colombia': { lat: 4.6, lng: -74.3 },
  'costa rica': { lat: 9.7, lng: -83.8 },
  'democratic republic of the congo': { lat: -2.9, lng: 23.7, areas: ['Dem. Rep. Congo'] },
  'ecuador': { lat: -1.8, lng: -78.2 },
  'el salvador': { lat: 13.8, lng: -88.9 },
  'eswatini': { lat: -26.5, lng: 31.5, areas: ['eSwatini'] },
  'ethiopia': { lat: 9.1, lng: 40.5 },
  'ghana': { lat: 7.9, lng: -1 },
  'guatemala': { lat: 15.8, lng: -90.2 },
  'haiti': { lat: 19, lng: -72.3 },
  'honduras': { lat: 15.2, lng: -86.2 },
  'india': { lat: 21.2, lng: 78.9 },
  'indonesia': { lat: -2.5, lng: 118 },
  'kenya': { lat: 0.2, lng: 37.9 },
  'laos': { lat: 19.9, lng: 102.5 },
  'lesotho': { lat: -29.6, lng: 28.2 },
  'madagascar': { lat: -18.8, lng: 46.9 },
  'malawi': { lat: -13.3, lng: 34.3 },
  'mali': { lat: 17.6, lng: -4 },
  'mexico': { lat: 23.6, lng: -102.5 },
  'mozambique': { lat: -18.7, lng: 35.5 },
  'myanmar': { lat: 21.9, lng: 95.9 },
  'namibia': { lat: -22.9, lng: 18.5 },
  'nepal': { lat: 28.4, lng: 84.1 },
  'nicaragua': { lat: 12.9, lng: -85.2 },
  'niger': { lat: 17.6, lng: 8.1 },
  'nigeria': { lat: 9.1, lng: 8.7 },
  'pakistan': { lat: 30.4, lng: 69.3 },
  'panama': { lat: 8.5, lng: -80.8 },
  'papua new guinea': { lat: -6.3, lng: 143.9 },
  'peru': { lat: -9.2, lng: -75 },
  'philippines': { lat: 12.9, lng: 121.8 },
  'rwanda': { lat: -1.9, lng: 29.9 },
  'senegal': { lat: 14.5, lng: -14.5 },
  'somalia': { lat: 5.2, lng: 46.2 },
  'south africa': { lat: -30.6, lng: 22.9 },
  'south sudan': { lat: 6.9, lng: 31.3, areas: ['S. Sudan'] },
  'sri lanka': { lat: 7.9, lng: 80.8 },
  'sudan': { lat: 12.9, lng: 30.2 },
  'tanzania': { lat: -6.4, lng: 34.9 },
  'thailand': { lat: 15.9, lng: 100.9 },
  'timor-leste': { lat: -8.9, lng: 125.7 },
  'uganda': { lat: 1.4, lng: 32.3 },
  'vietnam': { lat: 14.1, lng: 108.3 },
  'viet nam': { lat: 14.1, lng: 108.3, country: 'Vietnam' },
  'zambia': { lat: -13.1, lng: 27.8 },
  'zimbabwe': { lat: -19, lng: 29.2 }
};
