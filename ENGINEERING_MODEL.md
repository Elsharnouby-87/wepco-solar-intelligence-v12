# BED 1-17 · 8760-hour screening model — engineering provenance

**Scope:** interactive operational visualization and finance sensitivity; **not** a grid-forming controls approval, construction drawing, as-built, P50/P90, design basis freeze or guaranteed power/fuel saving.

## Confirmed user-supplied basis

- Location used by vendor PVsyst: latitude **29.8653° N**, longitude **28.5249° E**; an earlier field-coordinate set 29.871484° N, 28.515461° E is slightly different, so confirm the exact point of interconnection and PV footprint before final procurement.
- Financial workbook *WEPCO ESP Offer(2).xlsx*: **304 kWp + 321 kWh** reference alternative. **EPC USD 485,000**, **EGP/USD 55**, annual diesel use **740 L/day** baseline, nominal **5.5 h/day genset off**, **73.56 EGP/L** and **20% annual escalation** base price case, fixed O&M **1% EPC**, **18% discount**, **25-year** horizon. These assumptions are **separate** from physical dispatch.
- EMDAD SLD and Huawei files: **702 × Jinko 650 Wp ≈456.3 kWp**, **3×150 kW** PV inverters, **3×161.3 kWh = 483.9 kWh** LUNA2000 units and **3×108 kW=324 kW** PCS.
- Supplier PVsyst 456 kWp study: **909,658 kWh/year** grid-connected estimate with unlimited load, without BESS charge/discharge dispatch or genset curtailment; synthetic Meteonorm 9.0 weather. It is **not** exportable to the off-grid ESP balance without a dispatch model.
- On-site load basis: **165 kVA normal (including 10% buffer)**; **210 kVA startup**; **400/415 V, 3-phase, 50 Hz** indicated by field/source readings, final protection and VSD compatibility to be tested.

## Hourly weather file

- `js/weather.js` bundles **8,760 records** extracted from the supplied `hourly_year1.csv` already associated with this project. The source workbook identifies the hourly meteorological profile as a **PVGIS TMY** assembled from historical month selections between **2005 and 2023**. The stitched year therefore contains source timestamps from several years. It is **not a measured 2025/2026 year, real-time, or a forecast**.
- Each hour includes monthly calendar day, GHI (W/m²), ambient air temperature (°C), and a **derived** modelled AC PV output for a nominal 456 kWp case. This output is not a direct certified PVGIS output. The original annual AC output is **917,473.57 kWh** before 2-decimal rounding; the supplier PVsyst value is **909,658 kWh**, ~**0.86%** lower. Two negative wind-speed records (-0.5 m/s) in the source file were clamped to 0 for display; wind is **not** used in the dispatch.
- Reference API documentation: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en
- Independently measured hourly irradiance / new PVGIS retrieval was **not completed** in this revision. The supplied provenance should be audited against an archived raw PVGIS download and an as-built layout before investment approval.

## Deterministic 8760-hour model (`js/dispatch.js`)

- Each site-local calendar hour is treated as a 1-hour **average energy/power interval**, not instantaneous electrical power or transient behavior.
- User normal load is kVA; **kW = selected kVA × assumed power factor (default 0.90, editable)**. The VSD startup power/surges (210 kVA) require a dedicated load-starting/switching study.
- 304 kWp mode: PV output = source 456 kWp hourly AC value × 304/456, capped at 300 kW (2×150 kW); battery 321 kWh; PCS **150 kW assumed provisional model limit** (not a supplier-certified rating).
- Supplier 456 kWp mode: source 456 kWp hourly AC power capped at 450 kW, battery 483.9 kWh, 324 kW PCS rated.
- Battery state of charge limited to **20–90%**, initially 20% at simulation Jan 1 00:00, carried forward hour by hour. RTE **88%** from Huawei 161.3kWh datasheet, split as `ηcharge=ηdischarge=sqrt(0.88)` for a simplified lumped energy balance. 304 kWh BESS assumptions need independent supplier confirmation.
- **Conservative no-paralleling regime:** when PV plus deliverable BESS AC output can cover the complete load *for that full hour*, DG OFF, PV feeds load, BESS discharges if required and charges from excess; otherwise DG ON, covers full load and PV AC is curtailed. No DG-assisted BESS charging, power exports, generator sharing, transition losses, grid-forming ramp, transient reserve or reactive current simulation included.
- Hourly power balance is enforced `PV→ESP + BESS→ESP + DG→ESP = ESP load`. AC PV gross = PV delivered + BESS AC charging + curtailed PV for each hour; battery efficiency losses affect SOC correctly. Annually checked SOC in bounds, no negative energy and balance mismatch zero.
- Derived indicative diesel displacement `modeled DG-OFF hours × 740/24 L` is a **linear hour-based proxy**; source 740 L/day was measured/reported only at original load, and actual generator fuel consumption is not proportional to load or duration without engine load/fuel curves. **Do not market this as verified economic savings.**
- Annual off time can exceed the financial base-case 5.5 hours/day because the screening algorithm allows extended solar and BESS supply when weather and SOC permit. It must not be substituted for a guaranteed operating window or CAPEX without a detailed OEM controls and site field test.

## Initial model validation

| Case | DG-off hours per TMY | PV gross | Proxy diesel avoided |
|---|---:|---:|---:|
| 304 kWp / 321 kWh, 165 kVA, PF 0.90 | 3,385 h | 611.65 MWh | 104,371 L |
| 456 kWp / 483.9 kWh, 165 kVA, PF 0.90 | 4,038 h | 917.47 MWh | 124,505 L |

Both are **screening / potential** figures, not guaranteed minima. The financial letter retains a **conservative separate case: 5.5 h/day × 365 = 2,007.5 h/year, ~61,898 L/year**. The UI does not automatically conflate the two schemes. A button can copy the *304 kWp* modelled average off-hours to the finance controls as a clearly labelled screening sensitivity, not as the investment base.

## Required engineering closure to convert to bankable study

1. Confirm target coordinates, tilt/azimuth, soiling, array strings, AC/DC loss and as-built horizon shading.
2. Obtain original PVGIS TMY JSON/CSV with dataset selection and source-year mapping, compare NASA POWER / Meteonorm, and validate against actual on-site pyranometer / PVsyst monthly outputs.
3. Obtain ESP power historian (true kW, kVA, PF, harmonics, startup curve), generator governor/AVR and standby/prime load-fuel curve.
4. Confirm exact inverter and PCS firmware, grid-forming/load steps, brownfield SLD, anti-islanding, synchronizing and fail-safe protection, DG auto-start timing and black-start capability.
5. Validate SOC and BESS thermal derating, auxiliary loads, round-trip efficiency at part load/temperature, annual degradation/replacement and maintenance.
6. Run half-hour / 1-minute event model for transitions and startup, then revise procurement CAPEX for the selected 304 or 456 kWp BOM and recalculate financial cashflow at measured generator fuel curve.

## V3 engineering visualization update (5 November 2026)

The Three.js display is a **conceptual visualization**, not an issued-for-construction cable-routing model. It adds three-dimensional cable trays with visible side rails, bases, cross-rungs, supports, insulated conductors and metallic conduit risers. Routes represent system-level connections between PV inverters, battery storage, generator, LV board and ESP/VSD; actual site routing, buried sections, cable cross-sectional areas, hazardous-area classification, earthing and gland specifications remain **to be verified**.

Energy-flow indicators are emissive, directional streaks that follow the **tray centerlines** rather than curves floating above the site. Their speed and count are mapped monotonically to the modeled kW flowing through each path, with saturation at the selected illustrative reference power; they are not physical current or electric-field simulations. Charging runs opposite to discharging. The FLOW / NO FX control hides and restores the streaks and cable emissive effects **without hiding the physical infrastructure**. The model still uses `simulateYear()` for the PV/BESS/diesel logic. Financial model assumptions are unchanged.