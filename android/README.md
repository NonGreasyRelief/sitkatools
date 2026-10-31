# SitkaTools for Android

A thin Android app for the building tablets. It runs the same `SitkaTools/SitkaTools.html` as the office PCs, copied into the app when it's built, in one full-screen WebView. The app's native side gives the page what Android's WebView lacks. The page itself still makes no request to any other site.

Why an app and not Chrome: Chrome on Android puts a sleeping tab away and can't open a SharePoint folder. The app keeps the tablet's building in its own settings, brings the session back by itself when Android stops it, and later opens the SharePoint database folder itself (phase B).

The script ⇄ app messages are in [BRIDGE.md](BRIDGE.md).

## Phases

| Phase | What | State |
|---|---|---|
| **A. The app shell** | Everything below under "What the app does". The tablet works as it does in Chrome today (📂 Load DB from the OneDrive picker, 💾 Save DB through the share sheet → OneDrive), without Chrome's tab troubles. | **Done** (2026-10-29), tried on the emulator |
| **B. SharePoint folder** | Microsoft sign-in (MSAL), the database folder's link, and the page's 📁 folder mode backed by SharePoint through Microsoft Graph, directly from the app (user decision 2026-10-29; a WireGuard link to the office PC's synced folder was considered and dropped as too unreliable). Writes refuse to overwrite a file changed since it was read; per-building write rules. | Next: the director registers the app in Entra ID (2026-10-30; see "Asking IT") |
| **C. Pictures and camera upload** | Step pictures and videos streamed from the "Pictures and Videos" folder; ⬆️ Upload a new one there from the capture dialog. | |
| **D. PaperWizard PDFs** | Printed pages saved as PDFs to `Lot Archive/<lot>` on SharePoint. | |
| **E. New page versions and release** | A newer `SitkaTools.html` dropped in the folder's `App/` is picked up at the next start (with a fallback). The release signing key, and putting the app on tablets (sideload, or Intune / Managed Google Play). | |

## What the app does (phase A)

- **The page** loads from the app's own address, `https://appassets.androidplatform.net/SitkaTools/SitkaTools.html?device=<building>`, a name reserved for apps that never reaches the network (`PageRouter`). **Don't change that address:** the page's copy of unsaved work (IndexedDB) belongs to it. Every other site is refused; the 🗣️ Talk button's Google Translate opens outside the app.
- **Which building the tablet is** is asked at first start and kept by the app, then passed to the page as `?device=`. Changing it needs the **office PIN** (set at first start, 4–8 digits, kept only as a salted hash; five wrong tries wait a minute): hold the strip at the bottom of the screen. It's refused while anything is unsaved or a tool is open, because it reloads the page.
- **Saving:** 💾 Save DB → *Tap to save* opens Android's share sheet, as Chrome does on a tablet. Pick OneDrive → Upload. The save counts once an app is picked; dismissing the sheet leaves it unsaved and says so. The same goes for a recipe's ⬇️ Export and a step picture's 📤 Save.
- **Opening files:** 📂 Load DB and the other import buttons open Android's file picker (OneDrive appears in it once the OneDrive app is installed and signed in).
- **Camera:** DailyWizard's 📷 / 🎥 open the camera app straight away. The picture or video goes back to the page; cancelling gives it nothing.
- **Printing:** a print window (Print Todo, PaperWizard pages, badges…) opens full screen with 🖨️ Print (Android's print service, Letter) and ✕ Close; the window's own 🖨️ button prints too.
- **Dialogs** (the page's alert, confirm and prompt) are Android dialogs. Full-screen video works.
- **Back** closes a print window or full-screen video, otherwise it's Escape for the page. It never leaves the app.
- **When Android stops the app** (memory, battery), or the page's process crashes, the page comes back with its unsaved session and the tool that was open, without asking (`window.sitkaNative.resumed`).
- **The screen stays on** while the app is in front. A Bluetooth barcode scanner connecting, or the tablet turning, doesn't reload the page.
- **No 📁 folder mode yet:** the WebView claims it can pick folders but can't, so the app hides it (phase B brings it back, backed by SharePoint).
- **Needs** Android 8 (API 26) or newer, and Android System WebView 118 or newer (the page uses CSS `@scope`); otherwise the app says to update the WebView in the Play Store.

**What it keeps on the tablet:** the building and the PIN's hash (app settings), the page's copy of unsaved work (the WebView's own storage, as in Chrome), and two cache folders that empty themselves (`share/`: files saved through the share sheet, kept an hour for the app that took them, or dropped at once when the sheet is dismissed; `capture/`: the camera's pictures and videos, emptied when the app starts). Nothing goes into backups or a transfer to a new tablet. **Permissions:** internet only; the camera is used through the camera app.

## Page changes for the app

In `SitkaTools/SitkaTools.html`, each small and safe in every browser:

- **P2:** a page the app brought back (`window.sitkaNative.resumed`) restores its unsaved session by itself, as a reload does in Chrome (`checkWorkCopyOnStart`).
- **P4:** an Android app's built-in browser with no share sheet (Teams, Outlook: `; wv)` in its user agent) says the file wasn't saved instead of counting a lost download as saved (`shareFile`). In the SitkaTools app the share sheet is there, so this never shows.
- **P6:** `sitkaPageState()` → `{ unsaved, tool }`, which the app asks before it reloads the page.

## Build

Installed on this Mac (2026-10-29): Java 21 (`~/Library/Java/JavaVirtualMachines/jdk-21.0.13+9`), the Android SDK (`~/Library/Android/sdk`, named in `local.properties`, which isn't committed), Android Studio, and a Pixel Tablet emulator called **SitkaTablet**.

```sh
cd android
export JAVA_HOME=~/Library/Java/JavaVirtualMachines/jdk-21.0.13+9/Contents/Home
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
```

The build copies `../SitkaTools/SitkaTools.html` into the app byte for byte (`copyWebApp` in `app/build.gradle.kts`); the HTML itself stays build-free. **A changed page reaches the tablets only in a new build of the app** (until phase E).

## Try it

```sh
~/Library/Android/sdk/emulator/emulator -avd SitkaTablet -no-window -no-audio -no-snapshot-save -gpu swiftshader_indirect -camera-back emulated &
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.sitkalegends.sitkatools/.MainActivity
```

Or start SitkaTablet from Android Studio's Device Manager to see it. Debug builds let Chrome's `chrome://inspect` (or `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) reach the page; release builds don't.

**On a real tablet for testing:** copy the debug APK over and allow "Install unknown apps" for the file manager, or `adb install` over USB. Putting it on every tablet properly is phase E.

## Tests

- `node tests/run.mjs native-app` (from the repo root): the page's side in Firefox, with the app's before-page script and a fake app at the other end of its channel: `window.sitkaNative`, the boot report, printing, saving through the share sheet (the file in pieces, picked or dismissed), no folder mode, and P2, P4, P6.
- **Checked on the emulator** (2026-10-29): first start (building, PIN set, wrong and right PIN), the page starting with no errors, 📂 Load DB through the file picker, 💾 Save DB through the share sheet (a 1.9 MB database arrived whole; picking an app saved, dismissing didn't), a picture and a video from the camera app (and a cancel), a captured video saved through the share sheet, Android stopping the app with unsaved work and a tool open (both came back by themselves), the page's process crashing with a print window open (the app stayed, the session came back), and Print Todo's window printing through Android's print dialog (Letter). Android lint: no errors.
- **Still to try on a real tablet:** OneDrive's Upload from the share sheet and OneDrive in the file picker, a real camera, the Bluetooth barcode scanner, printing to the office printer.

## The application id

`com.sitkalegends.sitkatools` (the company's domain, sitkalegends.com, reversed; `app/build.gradle.kts`, user decision 2026-10-30). **Don't change it once the app is registered or on tablets:** Android treats an app with another id as a different app (its settings and unsaved work don't carry over), and the app registration for the Microsoft sign-in includes it (a new id needs a new redirect URI).

## Asking IT (phase B)

Phase B needs an **app registration** in the company's Microsoft tenant (Entra ID). Registration can take a while, so ask early.

What to ask IT for:

1. **An app registration:** single tenant, platform **Android**, with the app's **package name** (the application id, `com.sitkalegends.sitkatools`) and the **signature hash** of each key the app is signed with. IT's portal then makes the redirect URI, `msauth://<package name>/<signature hash, URL-encoded>`.
   - **Debug key** (test builds from this Mac): signature hash `OPmbpWd25al15ihakfmXdZ6BqlM=` (SHA-1 `38:F9:9B:A5:67:76:E5:A9:75:E6:28:5A:91:F9:97:75:9E:81:AA:53`). Its redirect URI: `msauth://com.sitkalegends.sitkatools/OPmbpWd25al15ihakfmXdZ6BqlM%3D`. A build made on another computer has another debug key.
   - **Release key:** made in phase E; its hash is added to the same registration then.
2. **Microsoft Graph, delegated `Sites.Selected`,** with admin consent, plus a **write** grant for this app on the one SharePoint site that holds the database. The app then reaches nothing but that site, and never more than the signed-in account itself can.
3. **One floor account per building**, signed in on that building's tablet, with these SharePoint permissions:
   - Main.json and the other buildings' files: read;
   - its own `Building-<id>.json`: edit, no delete;
   - add files in the database folder (for `-conflict-` copies);
   - its own pictures folder and `Lot Archive`: add and edit (phases C and D);
   - **Wages.json and the Archive folder: no access**;
   - `App/` (new page versions, phase E): read only. Whoever can write it changes the app on every tablet.
4. **A TEST site and folder** to try it out on. It's never the real database.
5. **Questions for IT:** how MFA and Conditional Access treat shared tablets with a floor account; whether the network inspects TLS (that can break sign-in); whether the tablets are, or will be, managed with Intune.
