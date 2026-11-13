// GET /api/trip -> {data, version} for the signed-in group (data is null if nothing saved yet)
// PUT /api/trip {data, version} -> editors only. Saves only if nobody else saved since
// `version`; otherwise 409 with the newer version so the page can ask what to do.
// Pass force:true to overwrite anyway.
const L = require("./_lib");

// Atomic compare-and-set: KEYS[1]=trip, KEYS[2]=version; ARGV[1]=expected version, ARGV[2]=data, ARGV[3]=force
const CAS = `local v=tonumber(redis.call('GET',KEYS[2]) or '0')
if ARGV[3]~='1' and v~=tonumber(ARGV[1]) then return -v-1 end
redis.call('SET',KEYS[1],ARGV[2])
return redis.call('INCR',KEYS[2])`;

module.exports = L.api(async (req, res) => {
  const s = L.session(req);
  if (!s) return res.status(401).json({ error: "Sign in first." });
  const g = await L.getGroup(s.g);
  if (!g) return res.status(401).json({ error: "This group no longer exists." });
  const k = L.gkey(g.name);

  if (req.method === "GET") {
    const [data, version] = await Promise.all([L.redis("GET", "t:" + k), L.redis("GET", "v:" + k)]);
    return res.json({ data: data ? JSON.parse(data) : null, version: +version || 0 });
  }
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });
  if (s.r !== "editor") return res.status(403).json({ error: "Viewers can’t save changes." });

  const b = L.body(req);
  if (!b.data || typeof b.data !== "object") return res.status(400).json({ error: "Nothing to save." });
  const n = await L.redis("EVAL", CAS, 2, "t:" + k, "v:" + k, +b.version || 0, JSON.stringify(b.data), b.force ? 1 : 0);
  if (+n < 0) return res.status(409).json({ error: "Someone else saved changes first.", version: -n - 1 });
  res.json({ version: +n });
});
