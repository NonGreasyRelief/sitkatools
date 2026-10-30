# SitkaTools for Android

A small Android app for the building tablets (user request 2026-10-29). It's one full-screen WebView running the `SitkaTools.html` that sits in a folder on the tablet, with that folder's training pictures and videos served beside it. Chrome on Android can't do this: a page opened from the Files app has no folder, so it can't see the pictures next to it.

**It doesn't talk to SharePoint, or to the internet at all.** It has no internet permission. The database is loaded and saved as in Chrome: 📂 Load DB opens Android's file picker (OneDrive / SharePoint appears there once the OneDrive app is signed in), and 💾 Save DB → *Tap to save* opens Android's share sheet (OneDrive → Upload). Nothing to register with IT.

## Setting up a tablet

1. Make a folder on the tablet, for example **Download/SitkaTools**, and copy into it `SitkaTools.html` and the training pictures and videos (from SharePoint's "Pictures and Videos" folder). The pictures can sit right next to `SitkaTools.html`, in a `pics/` folder, or in subfolders: the app finds a step's file anywhere in the folder by its name (`j234_1.jpg`, `j234_1.mp4`, `es_j234_1.jpg`…). These are the names 🖼 Picture files accepts, and case and leading zeros don't matter.
2. Install the app (see "Build"), open it, tap **📁 Pick the SitkaTools folder**, choose the folder, then **Use this folder → Allow**. It's asked once.
3. Load the database with 📂 Load DB, one file at a time if you like (Main.json, then the building's file). Set the device once with 🏢 Building Files → **🏷️ Set this device…**: the app remembers the page's address, so it opens as that building from then on, the way a bookmark would.

**A new SitkaTools.html:** copy it into the folder, over the old one. The app opens it the next time it starts. If the copy lands as `SitkaTools (1).html`, the newest SitkaTools page in the folder is the one opened, and a message says which.

**Another folder:** hold the app's icon → **📁 Change folder**. SitkaTools reopens from the new folder, and work that isn't saved comes back by itself. A folder with no `SitkaTools.html` in it is refused, and the page stays open from the old one.

## What the app does

- **The page** loads from the app's own address, `https://appassets.androidplatform.net/SitkaTools.html`, a name kept for apps that never reaches the network. **Don't change that address:** the page's copy of unsaved work (IndexedDB) belongs to it. Every other site is refused; the 🗣️ Talk button's Google Translate opens outside the app. Any file in the folder can be reached by its path (`/pics/…` finds a step's file anywhere in it).
- **Step pictures and videos** (DailyWizard) show straight from the folder. Videos can be scrubbed (byte ranges). Files copied into the folder while the app is open show once the page looks for them again (open SitkaTools again to be sure).
- **📷 / 🎥** open the camera app. **📤 Save** in the capture dialog writes the picture or video into the folder under the step's name, beside the step's file it replaces (else next to `SitkaTools.html`). Nothing is deleted: the step's earlier file is renamed `j234_1 (replaced 2026-10-29 14.05).png`, a name no step uses. Then the share sheet opens so it can go to SharePoint's "Pictures and Videos" for the other tablets; closing the sheet is fine, because it's already on this tablet.
- **Saving** anything else (database files, an archive, a recipe, a download link) goes through the share sheet. A save counts once an app is picked; dismissing the sheet leaves it unsaved and says so.
- **When Android stops the app** (memory, battery) or the page crashes, the page comes back with its unsaved session and the tool that was open, without asking, as Chrome does for a tab it put away. Opened anew (the app swiped away), the page asks *Restore session?* as usual.
- **Printing:** a print window (Print Todo, PaperWizard pages, badges…) opens full screen with 🖨️ Print (Android's print service, Letter) and ✕ Close.
- **Dialogs** are Android dialogs; full-screen video works; **Back** closes a print window or full-screen video, otherwise it's Escape for the page. A badge scanner connecting, or the tablet turning, doesn't reload the page.
- **No 📁 folder mode** for the database (the WebView can't pick a folder for the page): the database goes through the file picker and the share sheet.
- **Needs** Android 8 (API 26) or newer, and Android System WebView 118 or newer (the page uses CSS `@scope`); otherwise the app says to update the WebView in the Play Store.

**Permissions:** none (Android adds one for the app's own share-sheet callback). The camera is used through the camera app, and the folder only through the grant given when it was picked. **What it keeps:** the folder's grant and the page's address (app settings), the page's copy of unsaved work (the WebView's storage, as in Chrome), and two cache folders that empty themselves (`share/`: a file on its way to the share sheet, kept an hour for the app that took it; `capture/`: the camera's last picture or video). Nothing goes into backups or a transfer to a new tablet.

## How it's built

| File | What |
|---|---|
| `app/src/main/kotlin/com/sitkatools/app/MainActivity.kt` | The screen: the WebView, the folder screen, the file picker and camera, the share sheet, dialogs, print windows |
| `app/src/main/kotlin/com/sitkatools/app/TabletFolder.kt` | The tablet's folder: read through Android's folder grant, served at the app's address, a step's new picture or video written into it |
| `app/src/main/kotlin/com/sitkatools/app/SharedFiles.kt` | The two cache folders other apps may read one file at a time (share sheet, camera) |
| `app/src/main/assets/sitka-app.js` | The script the app runs before the page: `navigator.share` → the share sheet, print windows, no folder mode, `document.wasDiscarded` when the app reopened the page |

**The page has no code of its own for the app.** Everything it relies on is standard: `navigator.share` with a file, `document.wasDiscarded`, `?device=` in its address, and `pics/<step>.<ext>` beside it. `tests/native-app.test.mjs` runs `sitka-app.js` in Firefox against a fake app, so a page change that would break saving or session restore in the app fails there.

The page ⇄ app messages, over `SitkaApp` (only the app's own address can use it): `{ id, op, … }` in, `{ id, ok, result | error: { name, message } }` back. The ops are `shareBegin { name, type, size }` → `{ token }`, `shareChunk { token, data }` (base64, 192 KB of file each), `share { token, title }` (resolves once an app is picked, or once a step's file is in the folder; `AbortError` when the sheet is dismissed), and `print` (the top print window).

## Build

Installed on this Mac (2026-10-29): Java 21 (`~/Library/Java/JavaVirtualMachines/jdk-21.0.13+9`), the Android SDK (`~/Library/Android/sdk`, named in `local.properties`, which isn't committed), Android Studio, and a Pixel Tablet emulator called **SitkaTablet**.

```sh
cd native
export JAVA_HOME=~/Library/Java/JavaVirtualMachines/jdk-21.0.13+9/Contents/Home
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
```

Nothing of the page is built into the app, so a new `SitkaTools.html` needs no new build: copy it into each tablet's folder.

**Before it goes on the tablets:** settle the application id (`com.sitkatools.app` in `app/build.gradle.kts`; a new id is a new app, whose folder and unsaved work start over) and make a release signing key (the debug build is signed with this Mac's debug key). Put it on the tablets by sideloading the APK (Settings → allow installs from Files), or through your device management (Intune / Managed Google Play) if IT runs one.

## Try it

```sh
~/Library/Android/sdk/emulator/emulator -avd SitkaTablet -no-window -no-audio -no-snapshot-save -gpu swiftshader_indirect -camera-back emulated &
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb push SitkaToolsFolder/. /sdcard/Download/SitkaTools/    # SitkaTools.html and some pictures
```

The debug build lets Chrome's DevTools reach the page (`chrome://inspect`, or `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`).

Tried on the emulator (Android 16, WebView 133, 2026-10-29): the folder picked once; pictures found next to the page, in `pics/` and in a "Pictures and Videos" subfolder; a camera picture and a recorded video saved into the folder (the old picture kept, renamed) and shown, the video scrubbed; Building-B1.json then "Main (1).json" loaded one at a time with the file picker, opening as B1; Building-B1.json shared (dismissed: still unsaved; an app picked: saved); the B1 address kept after the app was stopped; the session and DailyWizard brought back by themselves after Android stopped the app and after a page crash; 📁 Change folder refusing a folder with no `SitkaTools.html`.
