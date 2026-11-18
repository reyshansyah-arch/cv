const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
  });
}

async function bodyJson(request) {
  try { return await request.json(); }
  catch { throw new Error("Body JSON tidak valid"); }
}

function validateVector(vector) {
  if (!Array.isArray(vector) || vector.length !== 150 ||
      !vector.every(n => Number.isFinite(n))) {
    throw new Error("Face Vector tidak valid. Diperlukan 150 angka landmark.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API endpoints are always handled by Worker. Other paths serve static files.
    if (!path.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (path === "/api/health" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ success: true, database: row?.ok === 1 ? "connected" : "unknown" });
      }

      if (path === "/api/bootstrap" && request.method === "GET") {
        const [usersResult, attendanceResult, settingsResult] = await Promise.all([
          env.DB.prepare(`
            SELECT id, name, email, department, registered_at AS registeredAt, face_vector
            FROM users ORDER BY registered_at DESC
          `).all(),
          env.DB.prepare(`
            SELECT id, user_id AS userId, user_name AS userName,
                   user_email AS userEmail, date, time, timestamp, status, method
            FROM attendance ORDER BY timestamp DESC LIMIT 5000
          `).all(),
          env.DB.prepare("SELECT value FROM settings WHERE key = 'threshold'").first()
        ]);

        const users = (usersResult.results || []).map(row => {
          let vector = [];
          try { vector = JSON.parse(row.face_vector || "[]"); } catch {}
          return {
            id: row.id, name: row.name, email: row.email,
            department: row.department, registeredAt: row.registeredAt,
            _faceVector: vector
          };
        });

        const faceData = {};
        for (const user of users) {
          if (Array.isArray(user._faceVector) && user._faceVector.length) {
            faceData[user.id] = user._faceVector;
          }
          delete user._faceVector;
        }

        return json({
          success: true,
          users,
          faceData,
          attendance: attendanceResult.results || [],
          settings: { threshold: Number(settingsResult?.value ?? 0.45) }
        });
      }

      if (path === "/api/users" && request.method === "POST") {
        const data = await bodyJson(request);
        const id = String(data.id || "").trim();
        const name = String(data.name || "").trim();
        const email = String(data.email || "").trim();
        const department = String(data.department || "").trim();
        validateVector(data.faceVector);
        if (!id || !name || !email || !department) {
          return json({ success: false, error: "Semua data pengguna wajib diisi." }, 400);
        }

        await env.DB.prepare(`
          INSERT INTO users (id, name, email, department, registered_at, face_vector)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, email=excluded.email,
            department=excluded.department, face_vector=excluded.face_vector
        `).bind(id, name, email, department,
          data.registeredAt || new Date().toISOString(),
          JSON.stringify(data.faceVector)).run();

        return json({ success: true });
      }

      const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
      if (userMatch) {
        const id = decodeURIComponent(userMatch[1]);

        if (request.method === "PUT") {
          const data = await bodyJson(request);
          await env.DB.prepare(`
            UPDATE users SET name=?, email=?, department=? WHERE id=?
          `).bind(String(data.name || ""), String(data.email || ""),
            String(data.department || ""), id).run();
          return json({ success: true });
        }

        if (request.method === "DELETE") {
          await env.DB.batch([
            env.DB.prepare("DELETE FROM attendance WHERE user_id=?").bind(id),
            env.DB.prepare("DELETE FROM users WHERE id=?").bind(id)
          ]);
          return json({ success: true });
        }
      }

      if (path === "/api/attendance" && request.method === "POST") {
        const r = await bodyJson(request);
        if (!r.id || !r.userId || !r.date || !r.time) {
          return json({ success: false, error: "Data presensi tidak lengkap." }, 400);
        }
        await env.DB.prepare(`
          INSERT INTO attendance
          (id, user_id, user_name, user_email, date, time, timestamp, status, method)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(String(r.id), String(r.userId), String(r.userName || ""),
          String(r.userEmail || ""), String(r.date), String(r.time),
          Number(r.timestamp || Date.now()), String(r.status || "Hadir"),
          String(r.method || "Scan Wajah")).run();
        return json({ success: true });
      }

      if (path === "/api/attendance" && request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM attendance").run();
        return json({ success: true });
      }

      if (path === "/api/settings" && request.method === "PUT") {
        const data = await bodyJson(request);
        const threshold = Number(data.threshold);
        if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 5) {
          return json({ success: false, error: "Nilai threshold tidak valid." }, 400);
        }
        await env.DB.prepare(`
          INSERT INTO settings (key, value) VALUES ('threshold', ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value
        `).bind(String(threshold)).run();
        return json({ success: true });
      }

      if (path === "/api/reset" && request.method === "POST") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM attendance"),
          env.DB.prepare("DELETE FROM users"),
          env.DB.prepare("DELETE FROM settings")
        ]);
        await env.DB.prepare(
          "INSERT INTO settings (key, value) VALUES ('threshold', '0.45')"
        ).run();
        return json({ success: true });
      }

      return json({ success: false, error: "Endpoint tidak ditemukan." }, 404);
    } catch (error) {
      return json({ success: false, error: error.message || "Kesalahan server." }, 500);
    }
  }
};
