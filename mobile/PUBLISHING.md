# Publishing the Todo app to the Play Store

This is an Android app built with [Capacitor](https://capacitorjs.com), wrapping
the same `index.html` / `style.css` / `script.js` from the web app in a native
shell. App ID: `com.abbaspirg.todo`.

The build couldn't be compiled inside this session (its network policy blocks
`dl.google.com`, which the Android Gradle Plugin needs), so a GitHub Actions
workflow (`.github/workflows/android-build.yml`) does it instead — GitHub's
runners have full internet access and a build takes a couple of minutes.

## 1. Get a debug build (no setup required)

Push this repo to GitHub, or run the workflow manually from the **Actions** tab
(`Android build` → **Run workflow**). It always produces a debug APK you can
sideload on any Android phone to try the app — download it from the workflow
run's **Artifacts** section (`todo-debug-apk`).

## 2. Create your signing key (one-time)

The Play Store requires every release to be signed with the same key for the
life of the app, so generate one now and keep it safe — if you lose it you
can't publish updates to the same app listing.

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias todo-release \
  -keyalg RSA -keysize 2048 -validity 10000
```

It'll ask for a password (used twice: store password and key password — they
can be the same) and some identity details (name/org — anything reasonable is
fine, it isn't shown to users). Keep `release.keystore` somewhere safe outside
git — back it up, e.g. in a password manager.

## 3. Add the signing secrets to GitHub

In the repo: **Settings → Secrets and variables → Actions → New repository
secret**. Add four secrets:

| Secret name                 | Value                                             |
| ---------------------------- | -------------------------------------------------- |
| `RELEASE_KEYSTORE_BASE64`    | `base64 -w0 release.keystore` (paste the output)   |
| `RELEASE_STORE_PASSWORD`     | the store password you chose                       |
| `RELEASE_KEY_ALIAS`          | `todo-release` (or whatever alias you used)        |
| `RELEASE_KEY_PASSWORD`       | the key password you chose                         |

Once these exist, every workflow run also builds a **signed** release bundle
and uploads it as the `todo-release-aab` artifact
(`app-release.aab`) — that's the file the Play Store wants.

## 4. Create the app in Play Console

1. Sign up / log in at [play.google.com/console](https://play.google.com/console)
   (one-time $25 registration fee if you're new).
2. **Create app** → name it "Todo", default language, app not game, free.
3. Under **App content**, fill in: privacy policy URL (required even for an
   app with no network access — a one-page statement that the app stores
   tasks only on-device and collects nothing is enough), content rating
   questionnaire, target audience/age, and the Data safety form (answer "no
   data collected" — this app only uses on-device `localStorage`).
4. Under **Store presence → Main store listing**: short + full description,
   app icon (already generated at `mobile/assets/icon.png`, 1024×1024), a
   feature graphic (1024×500 — not auto-generated, make one from the icon's
   gradient + "Todo" wordmark), and 2+ phone screenshots (open the app in
   Chrome DevTools device mode, or install the debug APK, and capture the
   list with a few tasks added).
5. Under **Release → Production** (or **Testing → Internal testing** to try
   it privately first): **Create new release**, upload `app-release.aab`,
   fill in release notes, save, then **Review release** and roll it out.

Google's review typically takes anywhere from a few hours to a few days for a
first submission.

## Updating the app later

Bump `versionCode` and `versionName` in `mobile/android/app/build.gradle`,
push, download the new signed AAB from the workflow run, and upload it as a
new release in Play Console — same signing key, so it updates the existing
listing.

## Building locally instead (optional)

If you'd rather build on your own machine: install
[Android Studio](https://developer.android.com/studio), open the `mobile/android`
folder, let it sync, then **Build → Generate Signed App Bundle**.
