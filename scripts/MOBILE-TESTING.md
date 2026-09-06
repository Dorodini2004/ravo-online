# Mobile verification

Run `npm test`, `npm run lint`, and `npm run build` first.
Start a local production server with `NODE_ENV=production` and `PORT=3101`.
Run `node scripts/mobile-check.cjs` with Playwright installed, or set
`RAVO_PLAYWRIGHT_PATH` to an external Playwright installation. Chrome must be installed.
`RAVO_TEST_URL` optionally selects another localhost port. The script refuses public servers.

The check creates disposable local rooms with 2 and 8 participants, checks
360/390/430px portrait and 844px landscape, both languages and all three view
sizes in gameplay/settings. It checks initial and enlarged hands, native horizontal
touch-event scrolling without playing, drawing, selecting/playing, the mobile Ravo
button, chat, and page overflow. Home, create/join and waiting-room widths are also
checked. Screenshots are saved in the OS temporary directory.

This is headless Chrome with mobile/touch emulation, not a physical phone.
Pinch-to-zoom and an actual on-screen keyboard still need a real-device check:

1. Open the site on iOS Safari and Android Chrome; pinch in/out in a game.
2. Open chat, focus the input, type/send with the keyboard visible, then close it.
3. Rotate while playing; verify that all controls remain reachable and the room stays connected.

The viewport explicitly permits user scaling and does not cap maximum scale.
The synthetic pinch command did not change visual viewport scale in the available
headless test; it is not counted as a successful pinch test.
