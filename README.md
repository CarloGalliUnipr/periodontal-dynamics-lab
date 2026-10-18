# Periodontal Dynamics Lab — temporary GitHub Pages prototype

A **disposable interactive teaching prototype** that explores the equations of the draft study *Host-response memory under periodic plaque removal: a dynamical model of post-therapy vulnerability and relapse in periodontitis*.

> **Not a clinical decision tool.** The model is phenomenological, uncalibrated, and its times and forces are dimensionless. This prototype is intended for exploration, not for selecting recall intervals or predicting patient outcomes. It is **not** a substitute for the reproducible research notebooks and data.

## Fastest way to publish it on GitHub

1. Download and **unzip** the provided project ZIP on your computer.
2. Create a **new public GitHub repository** (e.g. `periodontal-dynamics-prototype`).
3. On the new repository page, choose **Add file → Upload files**, and upload the unzipped contents **with the `docs` folder intact**. Commit the files. (Do **not** upload only the ZIP file: GitHub Pages cannot publish the files inside an unopened ZIP.) Alternatively, use Git or GitHub Desktop to push the whole folder.
4. Open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, branch **`main`**, folder **`/docs`**, then **Save**.
5. Wait for GitHub to show a published-site link (deployment can take a few minutes). The address typically has the form: `https://YOUR-USERNAME.github.io/periodontal-dynamics-prototype/`.

GitHub Pages documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

### Preview it without GitHub

Because the web page uses JavaScript modules, preview it via a small local web server:

```bash
cd periodontal-dynamics-prototype
python -m http.server 8000
```

Then visit `http://localhost:8000/docs/`.

No Python packages, npm packages, paid server, API keys, or accounts are needed for the website itself.

## What the prototype contains

- **Plaque cycles:** exponential regrowth and instantaneous removal, with adjustable growth, plateau, and interval.
- **Hill response:** visualize how baseline threshold, acquired memory, and Hill steepness alter the response to the same signal.
- **Memory ratchet:** numerically integrate the coupled H/M/A model under periodic forcing and compare finite memory with an instantaneous-adaptation host.
- **After therapy:** initialize two sites with the same low H and M but different A values obtained from the low/high equilibria of the reference system, allow recovery, apply a challenge, and compare their subsequent behavior.

The mathematical engine is in `docs/model.mjs`. Its reference settings come from the draft manuscript, but this interface is a **prototype**, not an audited publication figure generator. Unrestricted parameter exploration is not a calibrated biological prediction.

## Replace it when the model is finalized

Keep the repository URL and GitHub Pages configuration. To replace the prototype, simply upload new site files into **`docs/`**, replacing `index.html`, `styles.css`, `app.mjs`, and `model.mjs` (or replace `docs/` as a whole with a new `docs/` containing an `index.html`). Commit. The public URL stays the same, and Pages redeploys automatically.

If you want to remove the website entirely, disable GitHub Pages under Settings → Pages; deleting the `docs/` folder while Pages still points to it causes a deployment error.

**Recommended for the final release:** put the verified Python simulations, exported source data, exact paper presets, automated regression tests, version tag, DOI, and citation information in the repository alongside this website. Do not silently update the archived scientific package when the interactive educational interface changes.

## Numerical notes

The simulator uses fixed-step RK4 integrated separately within each plaque cycle, with discontinuous resets handled on cycle boundaries. State variables H/M are bounded to the model's nominal [0,1] interval in the visualization engine. The right-hand sides are:

- `dH/dt = -H + F(M + u; theta0*exp(-A))`
- `dM/dt = r[-M + G(H)]`
- `dA/dt = epsilon[alpha*H - A]`

with `F(S;theta) = S^n/(S^n+theta^n)` and `G(H) = H^q/(H^q+K^q)`.

The instant host uses `A = alpha*H` at every integration stage. The post-treatment scenario is an **idealized matched-state control**, not a simulation of the entire periodontal treatment process.

## Licence and attribution

Prototype code is provided under the MIT License (see `LICENSE`). Cite the scientific article (once finalized), not the prototype, for scientific results.
