# Bringing Gator Run Downs back

v1.5.4 removed Run Downs from the extension while the game is paused. Everything it used is kept so it can come back quickly.

What was removed in v1.5.4
- Popup: the Run Downs tab (races, Lunge / No Lunge picks, sign-in line, "Alert me when a race opens").
- Coin panel: the "Racing in Gator Run Downs" banner and its Customize checkbox (`race`).
- Trade ribbon: the "Run Downs picks" mode (`rd`) and the "Last race" item.
- Background: the toolbar badge, the `rd-now` alarm that checked `/api/now`, race notifications, and the `rdcheck` message.
- Manifest: the `alarms` permission, optional `notifications`, and the `https://gatorrundowns.fun/*` host permission.
- Store: the Run Downs listing text, permission justifications and data-usage boxes, and `shot-4-run-downs.png`.

Where it is kept
- Git tag `run-downs-v1.5.3`: the last full build with Run Downs (same code as store v1.5.3).
- `parked/run-downs/rundowns.js` and `parked/run-downs/shot-4-run-downs.png` (not zipped by `build.sh`).
- The removal is one commit on the `remove-run-downs-1.5.4` branch, so it can be undone with `git revert 997af30`.

To restore
1. Revert the removal commit (find it with `git log --oneline -- parked/run-downs`), or check out the files from the tag: `git checkout run-downs-v1.5.3 -- background.js content.js ribbon.js popup.html popup.js rundowns.js manifest.json build.sh store/LISTING.md store/shot-4-run-downs.png`.
2. Bump `version` in `manifest.json` above whatever the store has, and merge any non-Run Downs changes made since v1.5.4.
3. Remove the v1.5.4 cleanup block at the bottom of `background.js` (it resets a ribbon set to `rd`).
4. Check gatorrundowns.fun is answering `/api/now` and `/api/paddock`, and that its worker still accepts `POST /api/pick` from the extension origin.
5. `./build.sh`, then upload. Re-adding `gatorrundowns.fun` and `alarms` makes Chrome pause the extension until each user accepts the new permissions, and the store review will look at the permission justifications again (copy them from the tag's `store/LISTING.md`).
