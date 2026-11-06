# V11 QA / Performance closure

- Maintained independent V10 foundation and all original financial-base assumptions.
- Upgraded financial scenario cost guardrail: null or nonpositive CAPEX cannot produce project NPV/IRR.
- Updated topology source tests to tolerate code-format whitespace instead of brittle string equality.
- 3D animation now stops GPU rendering when the model is offscreen or tab hidden and throttles phone-sized viewports to roughly 30 fps.
- PV alternative switches release their local materials and textures as well as geometry, retaining shared 3D hardware materials.
- GitHub Pages CI runs npm test before build/deploy. AppDeploy preview is a separate public URL from the yet-to-be-created new GitHub repository.
