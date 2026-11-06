# WEPCO BED 1-17 V6 — Geometry & Power Flow Correction

## Source documents
- `Tiger Neo JKM650-670N-66QL6-BDV-F3C2-EN.pdf`: Jinko Tiger Neo module is ONE flat, dual-glass module; nominal 650 Wp; physical dimensions 2382 x 1134 x 30 mm.
- `EPROM ESP Solar Hybrid  SLD.pdf`: 702 modules in 39 strings (18 modules/string) to 3 x Huawei 150 kW solar inverter. Inverter **AC outputs** terminate at LV distribution panel; BESS with PCS and existing diesel generator have separate AC connections to the LV bus; ESP VSD is a load branch.
- `Operation philosophy.pdf`: Huawei off-grid PV+ESS with genset transfer switch controlled via SmartMGC. Exact project switching/control requires vendor and site confirmation.

## Corrections
1. PlaneGeometry starts in local XY; old module frames were local XZ, so front cell surfaces rendered perpendicular to the frame despite a common tilt transform. In V6 `faceGeo.rotateX(-Math.PI/2)` makes face coplanar with XZ frame, and both receive the same 25-degree rack tilt.
2. Modules shown have conceptual scale ~0.86 x 1.806, preserving the physical Jinko length/width ratio of 2382/1134. Face lies only 19 mm model units above frame and is inset; no transverse vertical front-face appears.
3. Power routes now distinct and one-way where appropriate: PV DC -> solar inverter; solar inverter AC -> LV; diesel -> LV; LV -> VSD; BESS/PCS <-> LV (reverse direction when charging). Paths are spatially separated with different colors and physical cable trays.
4. **PV DC display is AC-equivalent dispatched power** calculated from the hourly model. It is NOT a modeled DC-side power-meter reading or proof of DC efficiencies.
5. Diesel-on states in the conservative dispatch model curtail PV (no simultaneous DG/PV parallel operation), so solar-inverter outgoing flow is zero during DG supply. Battery charge arrows reverse relative to discharge arrows.
6. The source model financial case 304 kWp/321 kWh is independent of supplier 456 kWp/483.9 kWh. No change to annual financial calculations or PVGIS-TMY 8760-hour dispatch algorithm.
7. The solar array physical layout, module orientation and tilt, cable route lengths, trenches, isolators and breaker geometry are **conceptual**, not to scale, not construction-ready and not an as-built design. Exact cable sizes, positions, roof orientation, PCS compatibility, interlocks and hazardous area rating require detail engineering.

## QA criteria
- PV mesh face normal after rotation points skyward; frame and glass coplanar. 468 modules in financial visual and 702 in vendor visual.
- For every simulated hour: LV power balance error < 1e-5 kW; when DG-on, no inverter outgoing PV flow; PV AC flow must never reverse; BESS flow is reversed on charging.
- After user changes hour/load/design, live numbers and flow direction / highlighted cable route update together. Flow toggle hides light effects but leaves physical conduits visible.