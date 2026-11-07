# WEPCO Solar Intelligence — V13 Executive Redesign

## Goal

Remove unnecessary interaction and duplicative screens **without deleting engineering capability**.

## Delivered changes

1. **Executive-first dashboard:** one hero with four scenario-specific KPIs: simulated genset-off hours/day, avoided diesel litres/year, avoided tonnes CO₂/year, and the correct financial NPV.
2. **Three workspace sections:** Explore / Performance / Investment, replacing V10 plus V11 navigation clutter.
3. **Essential / Advanced progressive disclosure:** Essential is default; engineering data, old baseline, 64-case Pareto and exports appear only on request.
4. **Single global selector:** 304 kWp, 456 kWp or Custom. It updates 3D reference geometry and the V11 calculation.
5. **One financial source:** V11 lifecycle engine is the only financial KPI source in the executive interface; the previous 5.5-hour workbook model is archived separately, never merged.
6. **Reduced 3D controls:** Explore, Day/Night, Equipment; the full camera console remains in Advanced.
7. **Equipment microcards:** click a piece of equipment to see its rating; expand for the rationale and commissioning caveats.
8. **One source-flow story:** the same V11 representative-hour dispatch powers the simplified 4-source indicator and the 3D scene.
9. **One chart slot:** Energy / Battery / Diesel, or investment Cash Flow / Risk.
10. **Lazy technical optimization:** 64 full-year cases are simulated only in Advanced → Performance.
11. **Single executive report:** in-browser printable A4 decision brief with model disclosures, selected case and all financial inputs; browser may save as PDF.
12. **Professional polish:** restrained motion, responsive layouts, visible keyboard focus, reduced-motion support, mobile-friendly cards and throttled 3D.

## Code map

- `js/v13-shell.js`: executive navigation, UI mode, scenario sync, equipment cards, report, chart switching, methodology.
- `js/v13.css`: progressive disclosure and new mobile/desktop design language; original styles remain untouched.
- `js/v13-energy.js`: compact SVG-independent hourly source-flow strip.
- `js/v13-adapter.js`: V11 → original 3D energy/asset bridge; no financial model duplication.
- `js/v11-ui.js`: dispatches the canonical `wepco:v11-updated` event; on-demand tornado sensitivity.
- `js/v11-optimizer.js`: on-demand Pareto calculation instead of computing on page load.
- `tests_v13.mjs`: model invariants, source-to-scene equality and UX contract assertions.

## Known boundaries

This is a *conceptual screening demonstration*, not as-built engineering or an assured genset-off schedule. The scene's 3D geometry for a custom PV/BESS size is illustrative. The equipment card gives specifications from the previously attached concept docs, subject to verification. The source-flow chart represents hourly averages, not motor starting, grid-forming controller firmware, breaker synchronism or protection coordination. Exact PPA tariffs, on-site genset fuel curves and final EPC contracts have not been validated.

## Testing and release

Run `npm test` and `npm run build`. The GitHub Pages publish step requires the repository's Pages source to be enabled as GitHub Actions by its administrator. The separate AppDeploy project may be used for live functional inspection meanwhile.
