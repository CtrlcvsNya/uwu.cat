# UWU.CAT

> In a cat’s eyes, all things belong to dreams.

Source of [uwu.cat](https://uwu.cat) — a tiny personal landing page with a real-time **ASCII video background** rendered by a WebGL shader, in the spirit of the old Midjourney homepage.

## Features

- **ASCII video in a fragment shader** — the video is sampled per character cell on the GPU and mapped to a glyph atlas by brightness. The CPU only uploads one video texture per frame.
- **CRT look** — phosphor glow, RGB fringing, scanlines, aperture mask, rolling band and barrel curvature.
- **Interaction** — a scrambling lens follows the cursor; every click drops a water ripple (up to 8 at once) that refracts the video.
- **Swarm intro** — a crew of Figma-style multiplayer cursors builds the page live. Click the logo to start: the cursors type the tagline *Uplift With Uniqueness . Cats Always Touch*, press Play, and it collapses into its initials **UWU.CAT**; one of them pats the title (Nya~), then they carry the logo into the card together, paint it in, rebuild the card and a powered-off CRT (glass, scanlines copy-pasted down in waves), press Play again and fly off as the TV powers on and the video starts. Everything is accompanied by synthesized piano, keyboard and click sounds.
- Easy on the eyes: per-cell temporal smoothing (no glyph flicker), soft scanlines, a calm looping clip.
- Pauses when the tab is hidden, follows window resizes mid-intro, falls back to a plain animated intro if the swarm script can't load and to a plain video without WebGL. Esc skips the intro.

## Stack

[Next.js](https://nextjs.org) (static export) · [Motion](https://motion.dev) · Tailwind CSS v4 · WebGL · [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/)

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

| Path | What |
| --- | --- |
| `src/app/page.tsx` | Page & intro choreography |
| `src/app/components/AsciiVideo.tsx` | WebGL ASCII / CRT renderer |
| `public/swarm-cursors.js` | Swarm cursor engine + the scripted "session mode" the intro drives |
| `worker/index.ts` | Adds HTTP Range (206) support for videos — required by Safari / iOS |
| `scripts/media-sizes.mjs` | Records media file sizes for the worker at build time |
| `.github/workflows/deploy.yml` | CI: build on PRs, deploy on `main` |

## Deployment

Every push to `main` is built and deployed to Cloudflare Workers by GitHub Actions.
To deploy your own fork, add a repository secret `CLOUDFLARE_API_TOKEN` (an API token created from the **Edit Cloudflare Workers** template) and change `account_id` / `name` / `routes` in `wrangler.jsonc`. Manual deploy: `npm run deploy`.

## License

[CC BY-SA 4.0](LICENSE) © Ctrlcvs — you may share and adapt this work with attribution, under the same license.

**Exception:** the background video `public/media/kitten-540p.mp4` is a re-encode of
[“Kitten, Game, Pets”](https://pixabay.com/videos/kitten-game-pets-4216/) by MixailMixail from Pixabay,
used under the [Pixabay Content License](https://pixabay.com/service/license-summary/). It is **not** covered by CC BY-SA.

`public/swarm-cursors.js` is adapted from the [Swarm Rebuild](https://califa.github.io/swarm-site/) effect by Joel Califa,
which has no published license; it is used here with the original credit kept and is **not** covered by CC BY-SA.

*not for sale, AI last.*
