# WEPCO BED 1-17 — Solar Intelligence V12 — V11 Engineering Engine

Independent project forked in concept from V10. A visual digital twin, 8760-hour source dispatch simulator, lifecycle financial screening, equipment sizing Pareto, 5-year PPA/BOOT off-taker model, supplier comparison, and interactive SLD.

## Local environment

- Node.js 22
- `npm install`
- `npm test`
- `npm run dev` or `npm run build`

## Hosting

Prepared for GitHub Pages via `.github/workflows/pages.yml`. This is the separate V12 repository. The original V10 repository has not been modified. GitHub Pages must be enabled under Settings > Pages > Source: GitHub Actions. Initial independent build is available via AppDeploy.

## Evidence and caveats

Read `ENGINEERING_MODEL.md`, `V11_ENGINEERING_INTELLIGENCE.md` and `js/v11-model.js` before using financial or generator-off results. A 304 kWp / 321 kWh case alone has an EPC base input of USD 485k. Supplier 456 kWp has NO EPC quotation in the screening model until independently entered. Weather is PVGIS TMY-derived, not live readings. Original 3D and base-case cash flow are retained, separate from the new model. Fuel curves, grid-forming, synchronizing, battery degradation and replacement, 5-year PPA terms, VAT and risk costs require detailed engineering validation.

## Security

No proprietary supplier documents are bundled, but project assumptions, coordinates and estimated economics are visible in client-side code. Use a private repository until data publication has been authorized. AppDeploy preview URL is itself publicly reachable and must be shared appropriately.

## Preview

[Interactive V11 engineering demo on AppDeploy](https://wepco-solar-hybrid-intelligence-v11-xib961.v2.appdeploy.ai/) — this separate V12 repository preserves its source and adds automated GitHub Pages publishing.

## Site publication and information sensitivity

The live demonstration and this repository can expose scenario assumptions, vendor equipment names, oilfield site data and indicative financial results. Make this repository **private** until EPROM/WEPCO approve disclosure. If kept private, GitHub Pages publication depends on your account plan; alternatively continue reviewing the AppDeploy preview.
