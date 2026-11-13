// POST /api/admin {adminCode, action, ...}
//   list                              -> {groups:[{name}]}
//   save   {name, editor, viewer}     -> create a group, or change its passcodes (blank = keep)
//   delete {name}                     -> remove a group and its saved trip
// The admin passcode is the ADMIN_CODE environment variable in Vercel.
const L = require("./_lib");

module.exports = L.api(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ADMIN_CODE) return res.status(503).json({ error: "ADMIN_CODE isn’t set in Vercel yet." });
  const b = L.body(req);
  if (await L.tooMany(req, "admin")) return res.status(429).json({ error: "Too many wrong tries. Wait 15 minutes and try again." });
  if (!L.same(b.adminCode || "", process.env.ADMIN_CODE)) { await L.failed(req, "admin"); return res.status(401).json({ error: "Wrong admin passcode." }); }

  if (b.action === "list") {
    const keys = (await L.redis("SMEMBERS", "groups")) || [];
    const groups = [];
    for (const k of keys) { const g = await L.getGroup(k); if (g) groups.push({ name: g.name }); }
    groups.sort((a, c) => a.name.localeCompare(c.name));
    return res.json({ groups });
  }

  const name = String(b.name || "").trim().replace(/\s+/g, " ");
  if (!name) return res.status(400).json({ error: "Enter a group name." });
  const k = L.gkey(name);

  if (b.action === "delete") {
    await Promise.all(["g:", "t:", "v:"].map(p => L.redis("DEL", p + k)));
    await L.redis("SREM", "groups", k);
    return res.json({ ok: true });
  }
  if (b.action !== "save") return res.status(400).json({ error: "Unknown action." });

  const editor = String(b.editor || ""), viewer = String(b.viewer || "");
  const old = await L.getGroup(k);
  if (!old && (!editor || !viewer)) return res.status(400).json({ error: "A new group needs both an editor and a viewer passcode." });
  if ((editor && editor.length < 4) || (viewer && viewer.length < 4)) return res.status(400).json({ error: "Passcodes need at least 4 characters." });
  if (editor && viewer && editor === viewer) return res.status(400).json({ error: "The editor and viewer passcodes must be different." });

  // Blank passcode = keep the current one. Codes are stored only as salted hashes.
  const salt = old ? old.salt : L.crypto.randomBytes(16).toString("hex");
  const g = { name: old ? old.name : name, salt, editor: editor ? L.hash(editor, salt) : old.editor, viewer: viewer ? L.hash(viewer, salt) : old.viewer };
  if (g.editor === g.viewer) return res.status(400).json({ error: "The editor and viewer passcodes must be different." });
  await L.redis("SET", "g:" + k, JSON.stringify(g));
  await L.redis("SADD", "groups", k);
  res.json({ ok: true, created: !old, name: g.name });
});
