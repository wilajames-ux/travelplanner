# Tripboard (travel planner)

Single-file web app. Open `index.html` in a browser; no build step.

- `index.html`: current version (v2)
- `tripboard-v1-snapshot.html`: frozen v1
- `api/`: optional Vercel functions for shared, passcode-protected groups
- `CLAUDE.md`: notes on state, code layout and testing

## Groups and passcodes on Vercel

On Vercel the site asks for a **group name** and a **passcode**. Each group has its own trip and two passcodes:

- **Editor passcode**: view and edit. Changes save automatically for everyone in the group. Any number of people can share it.
- **Viewer passcode**: view only. Their edits stay on their own device and are never saved to the group.

If two editors change the trip at the same moment, the second one is asked whether to load the other person's version or keep theirs.

Opened anywhere without the `api/` functions (claude.ai, or the file opened directly) the app works as before, saving only in that browser.

### One-time setup

1. **Add storage.** In the Vercel project: Storage → Create Database → **Upstash for Redis** (free plan) → connect it to this project for all environments. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
2. **Set the admin passcode.** Settings → Environment Variables → add `ADMIN_CODE` with a passcode only you know. Optionally add `SESSION_SECRET` (any long random text); otherwise sign-ins are signed with `ADMIN_CODE`, and changing it signs everyone out.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new settings take effect.
4. **Create a group.** Open the site → *Admin: manage groups* → enter the admin passcode → fill in the group name (e.g. *China Family*), an editor passcode and a viewer passcode → *Save group*.

To change a passcode later, use *Change codes* on the admin screen and leave the other code blank to keep it. Group names ignore capital letters and extra spaces.

### Limits

- Photos are stored inside the trip. A save is limited to about 4.5 MB (Vercel's request limit), so very photo-heavy trips may need some photos removed.
- After 10 wrong passcodes, that network has to wait 15 minutes before trying again.
- Viewers can still click around and change things on their own screen; it just isn't saved.
