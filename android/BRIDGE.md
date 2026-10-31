# The page ⇄ app bridge

How `SitkaTools.html` and the Android app talk. Three sides follow this file: the before-page script (`app/src/main/assets/sitka-native-shim.js`), the app (`MainActivity.handle`) and the Firefox test's fake app (`tests/native-app.test.mjs`). A change to one changes all three, and this file.

## The before-page script

The app runs it at document start (`addDocumentStartJavaScript`) on its own address only (`https://appassets.androidplatform.net`), in the top frame only, before the page's own script. The app puts its settings in front of it:

```js
window.__sitkaNativeConfig = { api: 1, resumed: false, role: 'B6' | 'office' | null, appVersion: '0.1.0' };
```

It then sets up:

- **`window.sitkaNative`** (frozen, can't be replaced): `{ api, platform: 'android', appVersion, role, resumed, call(op, args) }`. The page's sign that it runs in the app. `resumed` is true when Android stopped the app and the app brought the page back (page change P2).
- **`navigator.share` / `navigator.canShare`:** one file at a time, through Android's share sheet (the `share*` requests below). `canShare` is true only for `{ files: [one File] }`. `share` resolves once an app is picked in the sheet, and rejects with an `AbortError` when the sheet is dismissed (a `TypeError` for anything but one file, an `InvalidStateError` while another share is going on). This is what every save on a tablet uses: `shareFile`, a recipe's ⬇️ Export, a step picture's 📤 Save.
- **`window.showDirectoryPicker`** is set to `undefined`, so the page shows no 📁 folder mode. The WebView has the function but can't pick a folder. Phase B replaces it with the SharePoint folder.
- **`window.open`** is wrapped: a print window's own `print()` asks the app to print it (`print`).
- **A boot report** on `load` (`boot`), with the first five page errors.

## Messages

The channel is `SitkaNativeBridge` (`addWebMessageListener`). The app takes messages only from its own address and the top frame. Every message is a JSON string.

- **Request:** `{ v: 1, id, op, …args }`; `id` counts up from 1 per page.
- **Answer**, exactly one per request, now or later: `{ id, ok: true, result }` or `{ id, ok: false, error: { name, message } }`.
- `sitkaNative.call(op, args)` returns a promise. It rejects with a `DOMException` carrying the error's name (`AbortError`, `NotSupportedError`…), so the page can tell them apart as it would a browser's.

| op | args | result | errors |
|---|---|---|---|
| `boot` | `ok` (the page's start check ran), `errors` (up to 5 messages) | `null` | — |
| `print` | — | `null` | `InvalidStateError`: no print window open |
| `shareBegin` | `name` (the file name the receiving app gets; path characters become `_`), `type` (MIME type), `size` (bytes) | `{ token }` | `DataError` (no size), `NotAllowedError` (over 1 GB), `QuotaExceededError` (the tablet is too full) |
| `shareChunk` | `token`, `data` (base64 of the next piece, 192 KB each from the script) | `null` | `InvalidStateError` (unknown token), `DataError` (damaged piece or more bytes than `size`; the file is dropped) |
| `share` | `token`, `title` (the share sheet's title) | `null`, once an app is picked | `DataError` (the file isn't whole), `InvalidStateError` (a sheet already open), `AbortError` (the sheet dismissed), `NotAllowedError` (no app can take it) |
| *anything else* | | | `NotSupportedError` |

**Share files** are written to the app's cache (`share/<token>/<name>`) and handed to the picked app through a FileProvider with a read grant for that file only. A dismissed share's file is deleted at once; a shared one after an hour (the app that took it may still be reading it).

## The app asking the page

- **`sitkaPageState()`** → `{ unsaved, tool }` (page change P6). Before the app reloads the page (holding the strip to change the building), it asks through `evaluateJavascript` and refuses while anything is unsaved or a tool is open.

## Page hooks for the app (in `SitkaTools.html`)

- **P2:** `checkWorkCopyOnStart` restores an unsaved session by itself when `window.sitkaNative?.resumed === true`, as for a reload.
- **P4:** `shareFile` in an Android in-app browser (`; wv)` in the user agent) with no `navigator.share` says the file wasn't saved and resolves `false`. The app's own WebView has the script's `navigator.share`, so this never shows there.
- **P6:** `sitkaPageState()`, above.

## Adding a request

Add it to the script (and to `window.sitkaNative` if the page calls it), to `MainActivity.handle`, to the fake app in `tests/native-app.test.mjs`, and to the table here. Keep each one narrow: the page asks for one thing, and the app checks every argument. The page must still make no request to another site.
