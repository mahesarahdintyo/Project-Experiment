"use client";

import React, { useState, useEffect, useCallback } from "react";
import HeaderNav from "@/components/HeaderNav";
import SQCDMPPanel from "@/components/SQCDMPPanel";
import { supabase } from "@/lib/supabaseClient";
import { Profile } from "@/types/database";

const MACHINES = [
  { key: "tandem", label: "Tandem" },
  { key: "blanking", label: "Blanking" },
  { key: "transfer_2000t", label: "Transfer 2000t" },
  { key: "transfer_800t", label: "Transfer 800t" },
  { key: "pc200t", label: "PC200t" },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<"harian" | "bulanan" | "tahunan">("harian");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [bulanPilih, setBulanPilih] = useState(new Date().getMonth());
  const [tahunPilih, setTahunPilih] = useState(new Date().getFullYear());
  const [shiftFilter, setShiftFilter] = useState("all");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [machinesTanpaTarget, setMachinesTanpaTarget] = useState<string[]>([]);
  const [paretoDowntime, setParetoDowntime] = useState<any[]>([]);
  const [fleetTop10, setFleetTop10] = useState<any[]>([]);

  const [absenForm, setAbsenForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    shift: 1,
    total_orang: 10,
    hadir: 10,
    absen: 0,
    overtime_jam: 0,
  });

  const [totals, setTotals] = useState({
    gsph: 0,
    targetGsph: 0,
    performanceFactor: 100,
    okQty: 0,
    ng: 0,
    targetQty: 0,
    availability: 100,
    downtimeMenit: 0,
    stroke: 0,
    dandoriMenit: 0,
    oee: 100,
  });

  const [attendance, setAttendance] = useState({ pct: 100, absen: 0 });
  const [machineDataMap, setMachineDataMap] = useState<Record<string, any>>({});
  const [lineAktif, setLineAktif] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (profData) setProfile(profData as Profile);
      }

      // 2. Fetch Production data according to filter
      let query = supabase.from("produksi_v2").select("*");
      if (periodMode === "harian") {
        query = query.eq("tanggal", tanggal);
        if (shiftFilter !== "all") {
          query = query.eq("shift", Number(shiftFilter));
        }
      } else if (periodMode === "bulanan") {
        const start = `${tahunPilih}-${String(bulanPilih + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(tahunPilih, bulanPilih + 1, 0).getDate();
        const end = `${tahunPilih}-${String(bulanPilih + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("tanggal", start).lte("tanggal", end);
      } else {
        query = query.gte("tanggal", `${tahunPilih}-01-01`).lte("tanggal", `${tahunPilih}-12-31`);
      }

      const { data: prodList, error: prodErr } = await query;
      if (prodErr) throw prodErr;

      // 3. Fetch Downtime data
      let dtQuery = supabase.from("downtime_v2").select("*");
      if (periodMode === "harian") {
        dtQuery = dtQuery.eq("tanggal", tanggal);
      }
      const { data: dtList } = await dtQuery;

      // Calculate totals
      let totalOK = 0;
      let totalNG = 0;
      let totalStroke = 0;
      let totalDowntime = 0;
      let totalDandori = 0;
      let activeLinesCount = 0;

      const perMachineMap: Record<string, any> = {};
      MACHINES.forEach((m) => {
        perMachineMap[m.key] = { stroke: 0, ok: 0, ng: 0, downtime: 0, gsph: 0, targetGsph: 100, oee: 100, status: "OFFLINE" };
      });

      if (prodList && prodList.length > 0) {
        const activeMachinesSet = new Set<string>();
        prodList.forEach((p) => {
          activeMachinesSet.add(p.mesin);
          totalOK += p.ok_qty || 0;
          totalNG += p.ng_qty || 0;
          totalStroke += (p.ok_qty || 0) + (p.ng_qty || 0);
          totalDandori += p.dandori_menit || 0;

          if (perMachineMap[p.mesin]) {
            perMachineMap[p.mesin].stroke += (p.ok_qty || 0) + (p.ng_qty || 0);
            perMachineMap[p.mesin].ok += p.ok_qty || 0;
            perMachineMap[p.mesin].ng += p.ng_qty || 0;
            perMachineMap[p.mesin].status = "RUNNING";
          }
        });
        activeLinesCount = activeMachinesSet.size;
      }

      if (dtList && dtList.length > 0) {
        const dtAgg: Record<string, number> = {};
        dtList.forEach((d) => {
          totalDowntime += d.durasi_menit || 0;
          if (perMachineMap[d.mesin]) {
            perMachineMap[d.mesin].downtime += d.durasi_menit || 0;
          }
          const probKey = d.deskripsi || d.kategori || "Unspecified";
          dtAgg[probKey] = (dtAgg[probKey] || 0) + (d.durasi_menit || 0);
        });

        // Pareto calculation
        const sortedPareto = Object.entries(dtAgg)
          .map(([problem, menit]) => ({
            problem,
            menit,
            pct: totalDowntime > 0 ? (menit / totalDowntime) * 100 : 0,
          }))
          .sort((a, b) => b.menit - a.menit)
          .slice(0, 5);
        setParetoDowntime(sortedPareto);

        // Top 10 fleet downtime
        const top10 = [...dtList]
          .sort((a, b) => (b.durasi_menit || 0) - (a.durasi_menit || 0))
          .slice(0, 10)
          .map((d) => ({
            mesin: d.mesin,
            mesinLabel: MACHINES.find((m) => m.key === d.mesin)?.label || d.mesin,
            kategori: d.kategori,
            problem: d.deskripsi,
            menit: d.durasi_menit,
          }));
        setFleetTop10(top10);
      } else {
        setParetoDowntime([]);
        setFleetTop10([]);
      }

      const calcGsph = Math.round(totalStroke / 8);
      const calcTargetGsph = 500;
      const perfFact = Math.min(100, Math.round((calcGsph / (calcTargetGsph || 1)) * 100));

      setTotals({
        gsph: calcGsph,
        targetGsph: calcTargetGsph,
        performanceFactor: perfFact,
        okQty: totalOK,
        ng: totalNG,
        targetQty: totalOK + totalNG + 500,
        availability: Math.max(0, Math.round(100 - (totalDowntime / 480) * 100)),
        downtimeMenit: totalDowntime,
        stroke: totalStroke,
        dandoriMenit: totalDandori,
        oee: Math.round((perfFact * (100 - Math.min(100, (totalDowntime / 480) * 100))) / 100),
      });

      setMachineDataMap(perMachineMap);
      setLineAktif(activeLinesCount);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [periodMode, tanggal, bulanPilih, tahunPilih, shiftFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSaveAbsensi = async () => {
    try {
      const { error } = await supabase.from("absensi_v2").insert({
        tanggal: absenForm.tanggal,
        shift: Number(absenForm.shift),
        total_orang: Number(absenForm.total_orang),
        hadir: Number(absenForm.hadir),
        absen: Number(absenForm.absen),
        overtime_jam: Number(absenForm.overtime_jam),
      });
      if (error) throw error;
      alert("Absensi berhasil disimpan!");
      fetchDashboardData();
    } catch (err: any) {
      alert("Gagal menyimpan absensi: " + err.message);
    }
  };

  const ngRatePct = totals.stroke > 0 ? (totals.ng / totals.stroke) * 100 : 0;
  const achievementPct = totals.targetQty > 0 ? (totals.okQty / totals.targetQty) * 100 : 0;
  const downtimePct = Math.min(100, (totals.downtimeMenit / 480) * 100);

  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  return (
    <HeaderNav>
      {/* Topbar Filter */}
      <div className="dash-topbar flex flex-wrap justify-between items-center mb-6 gap-4 border-b border-[var(--border)] pb-4">
        <div className="dash-title-block">
          <h1 className="text-2xl font-bold font-display tracking-tight">
            STAMPING PRODUCTION DASHBOARD
          </h1>
          <p className="text-xs text-[var(--muted)]">Monitoring &amp; Management Control</p>
        </div>

        <div className="dash-controls flex flex-wrap items-center gap-2">
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${periodMode === "harian" ? "chip-active" : ""}`}
              onClick={() => setPeriodMode("harian")}
            >
              Harian
            </button>
            <button
              type="button"
              className={`chip ${periodMode === "bulanan" ? "chip-active" : ""}`}
              onClick={() => setPeriodMode("bulanan")}
            >
              Bulanan
            </button>
            <button
              type="button"
              className={`chip ${periodMode === "tahunan" ? "chip-active" : ""}`}
              onClick={() => setPeriodMode("tahunan")}
            >
              Tahunan
            </button>
          </div>

          {periodMode === "harian" && (
            <>
              <input
                type="date"
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
              <select
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm"
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
              >
                <option value="all">Semua Shift</option>
                <option value="1">Shift 1 (07:00–19:30)</option>
                <option value="2">Shift 2 (19:30–07:00)</option>
              </select>
            </>
          )}

          {periodMode === "bulanan" && (
            <select
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm"
              value={bulanPilih}
              onChange={(e) => setBulanPilih(Number(e.target.value))}
            >
              {[
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
              ].map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          )}

          {(periodMode === "bulanan" || periodMode === "tahunan") && (
            <input
              type="number"
              min="2000"
              max="2100"
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm w-20"
              value={tahunPilih}
              onChange={(e) => setTahunPilih(Number(e.target.value))}
            />
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Memuat data dashboard...</p>
      ) : (
        <div className="space-y-6">
          {/* SQCDMP Control Panel */}
          <SQCDMPPanel
            totals={totals}
            ngRatePct={ngRatePct}
            achievementPct={achievementPct}
            downtimePct={downtimePct}
            attendance={attendance}
          />

          {/* Fleet Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="panel p-4 text-center">
              <span className="text-xs text-[var(--muted)] block font-mono">Total Stroke</span>
              <span className="text-xl font-bold font-mono">{fmtNum(totals.stroke)}</span>
            </div>
            <div className="panel p-4 text-center">
              <span className="text-xs text-[var(--muted)] block font-mono">Total Dandori</span>
              <span className="text-xl font-bold font-mono">{fmtNum(totals.dandoriMenit)} mnt</span>
            </div>
            <div className="panel p-4 text-center">
              <span className="text-xs text-[var(--muted)] block font-mono">Line Aktif</span>
              <span className="text-xl font-bold font-mono">{lineAktif} / {MACHINES.length}</span>
            </div>
            <div className="panel p-4 text-center">
              <span className="text-xs text-[var(--muted)] block font-mono">OEE Fleet</span>
              <span className="text-xl font-bold font-mono">{fmtNum(totals.oee)}%</span>
            </div>
          </div>

          {/* Line Status Table */}
          <div className="panel">
            <h3 className="panel-title font-bold text-base mb-4">Status Line Produksi</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Stroke</th>
                    <th>Actual GSPH</th>
                    <th>NG</th>
                    <th>Downtime</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MACHINES.map((m) => {
                    const data = machineDataMap[m.key] || { stroke: 0, gsph: 0, ng: 0, downtime: 0, status: "OFFLINE" };
                    return (
                      <tr key={m.key}>
                        <td>
                          <a href={`/machines/${m.key}`} className="font-bold hover:underline text-[var(--amber)]">
                            {m.label}
                          </a>
                        </td>
                        <td className="mono">{fmtNum(data.stroke)}</td>
                        <td className="mono">{fmtNum(data.gsph)}</td>
                        <td className="mono">{fmtNum(data.ng)}</td>
                        <td className="mono">{fmtNum(data.downtime)} mnt</td>
                        <td>
                          <span className={`badge ${data.status === "RUNNING" ? "role-admin" : ""}`}>
                            {data.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pareto & Fleet Top 10 Downtime */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="panel">
              <h3 className="panel-title font-bold text-base mb-4">Pareto Downtime (Menit)</h3>
              {paretoDowntime.length > 0 ? (
                <div className="space-y-3">
                  {paretoDowntime.map((row) => (
                    <div key={row.problem} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="truncate max-w-[200px]">{row.problem}</span>
                        <span>{fmtNum(row.menit)} mnt ({fmtNum(row.pct)}%)</span>
                      </div>
                      <div className="w-full bg-[var(--panel-2)] h-2 rounded overflow-hidden">
                        <div
                          className="bg-[var(--amber)] h-full transition-all duration-300"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Tidak ada data downtime.</p>
              )}
            </div>

            <div className="panel">
              <h3 className="panel-title font-bold text-base mb-4">Top Downtime Terburuk</h3>
              <div className="table-wrap max-h-[220px]">
                <table>
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Kategori</th>
                      <th>Problem</th>
                      <th>Menit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleetTop10.map((row, idx) => (
                      <tr key={idx}>
                        <td><span className="badge">{row.mesinLabel}</span></td>
                        <td>{row.kategori}</td>
                        <td className="truncate max-w-[150px]">{row.problem}</td>
                        <td className="mono">{fmtNum(row.menit)}</td>
                      </tr>
                    ))}
                    {fleetTop10.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-[var(--muted)] py-4">Belum ada catatan downtime</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Input Absensi Harian Panel (Leader/Admin) */}
          {(profile?.role === "admin" || profile?.role === "leader") && (
            <div className="panel">
              <h3 className="panel-title font-bold text-base mb-4">Input Absensi Harian</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Tanggal</label>
                  <input
                    type="date"
                    value={absenForm.tanggal}
                    onChange={(e) => setAbsenForm({ ...absenForm, tanggal: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Shift</label>
                  <select
                    value={absenForm.shift}
                    onChange={(e) => setAbsenForm({ ...absenForm, shift: Number(e.target.value) })}
                  >
                    <option value={1}>Shift 1</option>
                    <option value={2}>Shift 2</option>
                  </select>
                </div>
                <div className="field">
                  <label>Total Orang</label>
                  <input
                    type="number"
                    value={absenForm.total_orang}
                    onChange={(e) => setAbsenForm({ ...absenForm, total_orang: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Hadir</label>
                  <input
                    type="number"
                    value={absenForm.hadir}
                    onChange={(e) => setAbsenForm({ ...absenForm, hadir: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Absen</label>
                  <input
                    type="number"
                    value={absenForm.absen}
                    onChange={(e) => setAbsenForm({ ...absenForm, absen: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Overtime (jam)</label>
                  <input
                    type="number"
                    value={absenForm.overtime_jam}
                    onChange={(e) => setAbsenForm({ ...absenForm, overtime_jam: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="form-actions mt-4 flex justify-end">
                <button type="button" className="btn-primary" onClick={handleSaveAbsensi}>
                  Simpan Absensi
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </HeaderNav>
  );
}
