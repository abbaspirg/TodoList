# Ludo Circle

Ludo for **2 to 8 players** on separate phones, with **live voice chat** for
everyone in the room. Runs as an Android app and as an installable web app,
on a free Firebase project.

---

## Seven players on a four-player board

Ludo is a four-player game. The classic cross-shaped board has exactly four
arms, and no amount of redrawing fits a seventh player onto it.

So the board here is **generated from the player count** rather than drawn:
a ring of cells with one yard and one home column per player. Two players or
eight, the same code lays it out, and the rules in `www/js/game.js` never
need to know how many are playing.

At **four players the numbers come out exactly like the classic board** — a
52-cell track with starts 13 apart. It simply renders as a ring instead of a
cross. The track length is chosen as `52 / players` per segment (minimum 6),
so a seven-player game is 49 cells and takes about as long as a normal
four-player game rather than nearly twice as long.

| Players | Track cells | Starts apart |
|--------:|------------:|-------------:|
| 2 | 52 | 26 |
| 4 | 52 | 13 |
| 5 | 50 | 10 |
| 6 | 54 | 9 |
| **7** | **49** | **7** |
| 8 | 56 | 7 |

## Rules implemented

Standard Indian Ludo:

- Roll a **6** to bring a token out of the yard.
- A **6**, a **capture**, or **getting a token home** each earn another roll.
- **Three sixes in a row** forfeits the turn, and the third roll is not played.
- Landing on an opponent sends it back to its yard — unless it is on a **★
  square** or on any player's **start cell**, which are safe.
- The centre needs an **exact roll**; overshooting is not a legal move.
- Players are **ranked in the order they finish**, so a seven-player game
  produces a full 1st-to-7th placing rather than one winner and six
  people who just stop.

Deliberately not implemented: blocking (two of your own tokens on one cell
forming a wall). It is a common house rule but far from universal, and it
makes seven-player games drag.

Run the rules tests — no dependencies, no browser:

```bash
node ludo/test/game.test.mjs
```

They include thirty complete seven-player games played with random dice, to
prove the engine can't reach a state it gets stuck in.

## Live voice for seven

Every player connects **directly to every other player** — a mesh, not a
server. With seven people that is six connections each.

That would be hopeless for video: six outgoing video streams would melt a
phone. For **audio** it is comfortable — Opus speech runs about 24-40 kbit/s,
so six up and six down is well under half a megabit each way.

**This is the reason the app has no monthly cost.** Group *video* would need
a media server (an SFU), which is a real bill every month. Group *audio*
does not. The audio never touches Firebase, and WebRTC encrypts it between
the devices.

### The one thing that does cost money: a relay

Some networks — strict mobile carriers especially — won't let two phones
reach each other directly. Those pairs need a **TURN relay** to pass the
audio through. Typically 10-20% of connections; more on mobile data than on
home Wi-Fi.

Without a relay, most players still hear each other and a few pairs don't —
it degrades, it doesn't collapse. With one, everyone connects. There is no
free trick that avoids this: a relay carries real traffic, so it is either a
few dollars a month for a small VPS running [coturn](https://github.com/coturn/coturn)
or a hosted provider's free tier.

Add one per device under **Settings → Voice relay**, or bake one into a
build with the `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` variables.

## What the security rules can and cannot enforce

`firestore.rules` enforces that only players in a room can touch it, and
that **only the player whose turn it is can move**. That is real, and it is
what stops someone moving your tokens.

It cannot enforce the **dice**. With no server, the rolling device generates
its own number and writes it, so someone who edits the app could roll sixes
forever. Every roll and move is written to the game log all players can see,
which is the practical check among people who know each other — but it is
not cryptographic. Fixing it properly needs either a server or a
commit-reveal scheme between players; both were out of scope for a free,
serverless app. Worth knowing before you play for money.

## Setting it up

1. Create a Firebase project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Anonymous → Enable.** Players never
   type a password; the app signs each device in silently.
3. **Firestore Database → Create database.**
4. Publish the rules in `ludo/firestore.rules` (paste them into
   Firestore → Rules → Publish).
5. Add a **Web app** to the project and copy its config.
6. Open the app and paste that config into the setup screen — or bake it in
   for everyone via the `LUDO_FIREBASE_CONFIG` repository variable, which
   the deploy workflow reads.

A Firebase *web* config is not a secret: it ships in the source of every
Firebase web app, and the rules plus Auth are what control access.

### Cost

A Ludo game is a few hundred document writes. The free Spark plan allows
20,000 writes and 50,000 reads a day, so a family playing daily stays well
inside it. Nothing here uses Cloud Functions or Cloud Storage, both of which
would require the paid plan.

## Running it

**Web / Windows / iPhone** — deployed to GitHub Pages at `/ludo/` by
`.github/workflows/pages.yml`. Open the link and use the browser's "Install
this site as an app" to get a real window and an icon.

**Android** — `.github/workflows/android-build.yml` builds a debug APK.
Locally:

```bash
cd ludo
npm install
npx cap add android      # first time only
npm run sync
cd android && ./gradlew assembleDebug
```

**Locally in a browser**, with a real Firebase project:

```bash
python3 -m http.server 8000 --directory ludo/www
```

**Locally with no Firebase project at all**, for development — a test
harness swaps the Firebase layer for an in-memory fake so several browser
tabs play against each other:

```bash
node ludo/test/make-harness.mjs
python3 -m http.server 8099 --directory ludo
# open http://localhost:8099/www/_harness.html in several tabs
```

`www/_harness.html` is generated, not committed — it is `index.html` with
one module swapped, so it can never drift from the real page.

## Layout

```
ludo/
  www/js/game.js       rules engine — pure, no DOM, no network
  www/js/layout.js     board geometry for N players
  www/js/render.js     canvas painter
  www/js/rooms.js      Firestore room sync
  www/js/voice.js      WebRTC audio mesh
  www/js/ice.js        STUN/TURN configuration
  www/js/views/        home, lobby, game, settings screens
  test/game.test.mjs   rules tests
  test/fake-firebase.js in-memory Firebase stand-in for the harness
  firestore.rules      access rules — publish these
```
