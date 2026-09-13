# Fragmented Reality

A plain HTML, CSS, and JavaScript scrollytelling website.

## Develop locally

Install the dependencies once, then start the Vite development server:

```sh
npm install
npm run dev
```

## Build and deploy

Create the finished static website with:

```sh
npm run build
```

Vite writes the deployable site to `dist/`. Upload the **contents** of that
folder to the root of the deployment branch or destination web folder. The
build uses folder-relative asset paths, so it works both at a domain root and
inside a subfolder such as a GitHub Pages project site.

To test the production build locally:

```sh
npm run preview
```

## Structure

```text
index.html             page entry
script.js              small JavaScript entry point
src/js/main.js         application bootstrap
src/js/content.js      chapter and story content data
src/js/navigation.js   main/side navigation and sound controls
src/js/sections.js     section HTML builders
src/js/scrollytelling.js Scrollama and animation state
src/js/forest-map.js   D3 map rendering
src/js/pseudorelief-model.js Three.js model rendering
src/js/utils.js        shared JavaScript helpers
docs/annotated/        commented JavaScript learning copy
src/styles/            tokens, global, navigation, and section CSS
public/media/          video, PNG, SVG, and map assets
src/assets/fonts/      local Work Sans, Georgia, and Flor DeRuina fonts
```

The project’s typography, spacing, colour, and responsive rules are documented in [STYLEGUIDE.md](./STYLEGUIDE.md).

The JavaScript is explained in [docs/annotated/README.md](./docs/annotated/README.md). Its commented copy is not loaded by the website, so the modular files in `src/js/` remain clean production sources.

For GitHub Pages, keep the source project on `main`, place only the contents of
`dist/` on the `gh-pages` branch, and configure Pages to publish from the root
of that branch. The included `public/.nojekyll` file is copied into every build.
