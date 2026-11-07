# WEPCO Solar Hybrid Intelligence V13

**Executive-first. Engineering-capable. Scenario-specific.**

This repository implements an independent interactive engineering screening platform for the WEPCO BED 1-17 ESP solar hybrid project. It retains the original V10 Three.js equipment site and V11 physical/financial simulation, while replacing the information architecture with a minimal, progressive-disclosure V13 experience.

## Three experiences — one consistent scenario

- **Explore:** 3D conceptual system, a short optional cinematic tour, instant equipment information and a single power flow. Move the hourly slider or tap Day/Night.
- **Performance:** 8,760-hour power mix, generator-off hours, diesel and CO₂ proxy savings, one chart toggling Energy / Battery / Diesel. The same active design drives 3D source-flow animation and summary KPIs.
- **Investment:** single 25-year EPC or 5-year PPA/BOOT lifecycle engine, scenario-specific CAPEX, NPV/IRR/payback and focused Cash Flow / Risk visualization.

**Essential** mode shows only the most valuable information. **Advanced** reveals assumptions, full configuration input, technical comparison, conceptual SLD, Pareto sizing of 64 designs, underlying old-reference workbook and CSV exports. The 64-case optimizer does not compute on normal page load.

## Key engineering guardrails

- The original **5.5 h/day** generator shutdown is a separate workbook/reference assumption and is never confused with the new 8,760-hour simulated result.
- Physical 3D equipment layouts correspond to the 304 kWp feasibility or 456 kWp supplier concept. A **Custom** input uses the nearest conceptual mesh geometry, clearly labelled as illustrative, while calculations use the actual custom rating.
- A 304 kWp/321 kWh feasibility case alone has the **USD 485,000 initial EPC input**. The 456 kWp/483.9 kWh supplier case and custom variants have **no EPC quote** until entered. Financial results are suppressed for missing costs.
- PV from PVGIS TMY-derived hourly data is **not** a certified P50/P90 forecast. Microgrid switching, start-up dynamics, OEM fuel consumption curves, interlocks, thermal constraints and tariff contracts require engineering validation.
- The diesel and CO₂ numbers are **projections, not measured or credit-verified savings**. PV performance, battery fade/replacement and O&M inflation are explicitly provisional assumptions.
- The GUI's financial decision KPIs use the V11 engine; older, different financial assumptions are stored under **Advanced → Original workbook reference**.

## Run and validate

Node.js 22 recommended.

```bash
npm install
npm test
npm run dev
npm run build
```

The GitHub Actions workflow runs the dispatch, topology, V11 and V13 tests before building. If Pages is set to **Settings → Pages → Build and deployment → GitHub Actions**, the successful workflow publishes the `dist` output.

## Security

This repository is public at the time of preparation, exposing conceptual oilfield location, equipment names and financial assumptions. Do not publish proprietary EPC quotes, internal site documents, actual identities or non-public field operating records here without EPROM/WEPCO authorization. GitHub Pages content itself is public even when access to the GitHub source is restricted in some setups.

## Live preview

[AppDeploy V13 engineering experience](https://wepco-solar-hybrid-intelligence-v11-xib961.v2.appdeploy.ai/) — preview URL retained from the independently created app.

For the detailed model assumptions and release notes, read `ENGINEERING_MODEL.md`, `V11_ENGINEERING_INTELLIGENCE.md` and `V13_EXECUTIVE_REDESIGN.md`.
