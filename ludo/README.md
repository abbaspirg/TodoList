# Ludo Circle

Ludo for **2 to 8 players**, two ways:

- **On one phone** — pass it round, everyone takes their turn on the same
  screen. Needs no internet, no account and no setup at all.
- **On separate phones** — with **live voice chat** for everyone in the
  room. This is the part that needs a free Firebase project.

Runs as an Android app and as an installable web app.

---

## Playing on one phone

Open the app, pick how many players, optionally type their names, and start.
The die is always live for whoever is on turn, and the status line names
them ("Ayesha — roll!") so there is no doubt whose go it is. Voice chat and
emoji throwing are hidden, because everyone is already looking at the same
screen.

The game is **saved after every move**, so locking the phone or closing the
app doesn't lose it — the home screen offers to resume.

This mode shares the entire board, renderer and rules engine with online
play. The only difference is where the state lives: `js/local-game.js`
presents the same shape as a Firestore room document, so nothing else in the
app needs to know which mode it is in.

## Two boards, because seven players don't fit on one

Ludo is a four-player game. The classic cross board has exactly four arms,
and no amount of redrawing fits a seventh player onto it. So there are two
boards, picked automatically by player count:

**Two to four players get the real cross board** — the one everyone knows.
52 cells, starts 13 apart, eight printed safe squares, four corner yards,
red/green/yellow/blue. Nothing about it is approximated. Two players sit at
opposite corners, as on a real board; three leave the fourth corner greyed.

**Five to eight players get a polygon board** — the same shape a physical
seven-player Ludo set uses: one triangular yard per player around the rim,
three radial lanes per arm, coloured home spokes and a segmented centre.

Both boards are the same structure underneath. An arm is a lane of cells
running outward, one cell across the tip, and a lane running back, with the
home column up the middle:

```
   outward lane │ home column │ returning lane
                └──── tip ────┘
```

The only difference is the lane length: six cells on the cross (giving 13
per arm and the classic 52-cell track), four on the polygon. Four, because
seven arms of thirteen would be a 91-cell track and a game nobody finishes.

| Players | Board | Track cells | Steps to home |
|--------:|:------|------------:|--------------:|
| 2 | cross | 52 | 57 |
| 3 | cross | 52 | 57 |
| 4 | cross | 52 | 57 |
| 5 | polygon | 45 | 48 |
| 6 | polygon | 54 | 57 |
| **7** | **polygon** | **63** | **66** |
| 8 | polygon | 72 | 75 |

Every board lands within 40% of the classic board's length, so a
seven-player game takes about as long as a four-player one rather than
twice as long.

## Feel

- **The die tumbles** through faces before settling, with a rattle
  synthesised on the spot.
- **Pieces walk**, one square at a time, with a tick per square that rises
  in pitch — so a six *looks and sounds* like six steps rather than a
  teleport. Captures, reaching home and winning each have their own sound.
- **Emoji throws**: tap 😀, pick from twelve, and it sails across every
  player's screen with your name on it.
- Sound can be muted from the game screen; it is remembered per device.

All sound is **synthesised with the Web Audio API** rather than loaded from
files. No binary assets to ship, no licensing to sort out per effect, no
slower first load — and tuning a sound means changing a number.

## Rules implemented

Standard Indian Ludo:

- Roll a **6** to bring a token out of the yard.
- A **6**, a **capture**, or **getting a token home** each earn another roll.
- **Three sixes in a row** forfeits the turn, and the third roll is not played.
- Landing on an opponent sends it back to its yard — unless it is on a **★
  square** or on any player's **start cell**, which are safe. The cross
  board uses the eight safe squares printed on a real board; the polygon
  board puts a star midway along each arm.
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

## When someone's phone locks

Only the player on turn may write the board — that is what stops anyone
moving your pieces. It also means one locked phone, one lost signal or one
person wandering off used to stop the game dead for everybody, with no way
out. So:

- The die is never a dead button. Tapping it when you can't roll says why —
  "Waiting for Ayesha to roll", "You've rolled, now tap a token".
- After 25 seconds with nothing happening, everyone else gets a **Skip
  <name>** button. It moves play on without touching the board.

`firestore.rules` backs this up: the host can always act, and once a room
has sat untouched for 15 seconds *any* player may — so the game can be
rescued even when the host is the one who vanished.

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

None of this is needed to play on one phone — only to play across devices.

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

**Android** — `.github/workflows/ludo-android.yml` builds a debug APK.
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
  www/js/game.js          rules engine — pure, no DOM, no network
  www/js/board-classic.js geometry of the cross board (2-4 players)
  www/js/layout-polygon.js geometry of the polygon board (5-8 players)
  www/js/render.js        painter — picks a board and owns the tap targets
  www/js/animate.js       dice tumble and piece-by-piece move animation
  www/js/sound.js         synthesised sound effects
  www/js/emotes.js        emoji throwing
  www/js/rooms.js      Firestore room sync
  www/js/voice.js      WebRTC audio mesh
  www/js/ice.js        STUN/TURN configuration
  www/js/views/        home, lobby, game, settings screens
  test/game.test.mjs   rules tests
  test/fake-firebase.js in-memory Firebase stand-in for the harness
  firestore.rules      access rules — publish these
```
