
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API untuk mengecek koneksi database
    if (url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1").first();

        return Response.json({
          success: true,
          message: "Worker dan D1 berhasil terhubung"
        });
      } catch (error) {
        return Response.json({
          success: false,
          message: "Database belum terhubung"
        }, { status: 500 });
      }
    }

    // Mengambil data presensi
    if (url.pathname === "/api/presensi" &&
        request.method === "GET") {
      try {
        const { results } = await env.DB
          .prepare(
            "SELECT id, nama, status, metode, waktu FROM presensi ORDER BY id DESC"
          )
          .all();

        return Response.json({
          success: true,
          data: results
        });
      } catch (error) {
        return Response.json({
          success: false,
          message: "Gagal mengambil data"
        }, { status: 500 });
      }
    }

    // Menyimpan data presensi
    if (url.pathname === "/api/presensi" &&
        request.method === "POST") {
      try {
        const body = await request.json();

        if (!body.nama || typeof body.nama !== "string") {
          return Response.json({
            success: false,
            message: "Nama wajib diisi"
          }, { status: 400 });
        }

        const nama = body.nama.trim();
        const status = body.status || "Hadir";
        const metode = body.metode || "Wajah";

        if (!nama || nama.length > 150) {
          return Response.json({
            success: false,
            message: "Nama tidak valid"
          }, { status: 400 });
        }

        const result = await env.DB
          .prepare(
            `INSERT INTO presensi (nama, status, metode)
             VALUES (?, ?, ?)`
          )
          .bind(nama, status, metode)
          .run();

        return Response.json({
          success: true,
          message: "Presensi berhasil disimpan",
          id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json({
          success: false,
          message: "Gagal menyimpan presensi"
        }, { status: 500 });
      }
    }

    // Selain API, tampilkan file frontend
    return env.ASSETS.fetch(request);
  }
};
