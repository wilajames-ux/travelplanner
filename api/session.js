// GET  /api/session  -> who is signed in ({server:true, group, role} or {server:true})
// POST /api/session  {group, code}  -> sign in to a group as editor or viewer
// DELETE /api/session -> sign out
const L = require("./_lib");

module.exports = L.api(async (req, res) => {
  if (req.method === "GET") {
    const s = L.session(req);
    let group = null;
    if (s) { const g = await L.getGroup(s.g); if (g) group = g.name; }
    return res.json(group ? { server: true, group, role: s.r } : { server: true });
  }
  if (req.method === "DELETE") { L.clearSession(res); return res.json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { group, code } = L.body(req);
  if (!String(group || "").trim() || !String(code || "")) return res.status(400).json({ error: "Enter the group name and passcode." });
  if (await L.tooMany(req, "login")) return res.status(429).json({ error: "Too many wrong tries. Wait 15 minutes and try again." });
  const g = await L.getGroup(group);
  let role = null;
  if (g) {
    if (L.same(L.hash(code, g.salt), g.editor)) role = "editor";
    else if (L.same(L.hash(code, g.salt), g.viewer)) role = "viewer";
  }
  if (!role) { await L.failed(req, "login"); return res.status(401).json({ error: "That group name and passcode don’t match." }); }
  L.setSession(res, { g: L.gkey(g.name), r: role });
  res.json({ server: true, group: g.name, role });
});
