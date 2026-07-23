"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import SQCDMPPanel from "@/components/SQCDMPPanel";
import { supabase } from "@/lib/supabaseClient";
import { Profile } from "@/types/database";

const MACHINES = [
  { key: "tandem", label: "Tandem", slug: "tandem" },
  { key: "blanking", label: "Blanking", slug: "blanking" },
  { key: "transfer_2000t", label: "Transfer 2000t", slug: "transfer-2000t" },
  { key: "transfer_800t", label: "Transfer 800t", slug: "transfer-800t" },
  { key: "pc200t", label: "PC200t", slug: "pc200t" },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<"harian" | "bulanan" | "tahunan">("harian");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [bulanPilih, setBulanPilih] = useState(new Date().getMonth());
  const [tahunPilih, setTahunPilih] = useState(new Date().getFullYear());
  const [shiftFilter, setShiftFilter] = useState("all");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [paretoDowntime, setParetoDowntime] = useState<any[]>([]);
  const [fleetTop10, setFleetTop10] = useState<any[]>([]);
  const [downtimeKategori, setDowntimeKategori] = useState<any[]>([]);
  const [machineDataMap, setMachineDataMap] = useState<Record<string, any>>({});
  const [lineAktif, setLineAktif] = useState(0);
  const [machinesTanpaTarget, setMachinesTanpaTarget] = useState<string[]>([]);

  const [totals, setTotals] = useState({
    gsph: 0, targetGsph: 0, performanceFactor: 0,
    okQty: 0, ng: 0, targetQty: 0,
    availability: 100, downtimeMenit: 0,
    stroke: 0, dandoriMenit: 0, oee: 0,
    ngValueRp: 0,
  });

  const [safety, setSafety] = useState({ hariTanpaAccident: 0, accident: 0 });
  const [scrapValueRp, setScrapValueRp] = useState(0);

  const [attendance, setAttendance] = useState({
    pctExclCuti: 0,
    total_orang: 0,
    hadir: 0,
    cuti: 0,
    absen: 0,
    overtime_jam: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Profile
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profData } = await supabase
          .from("profiles").select("*").eq("id", session.user.id).single();
        if (profData) setProfile(profData as Profile);
      }

      // 2. Build date range filter
      let startDate = tanggal;
      let endDate = tanggal;
      if (periodMode === "bulanan") {
        const yr = tahunPilih, mo = bulanPilih;
        startDate = `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(yr, mo + 1, 0).getDate();
        endDate = `${yr}-${String(mo + 1).padStart(2, "0")}-${lastDay}`;
      } else if (periodMode === "tahunan") {
        startDate = `${tahunPilih}-01-01`;
        endDate = `${tahunPilih}-12-31`;
      }

      // 3. Fetch Production Log
      let prodList: any[] = [];
      let prodQ = supabase.from("production_log").select("*")
        .gte("tanggal", startDate).lte("tanggal", endDate);
      if (shiftFilter !== "all") prodQ = prodQ.eq("shift", Number(shiftFilter));
      let prodRes = await prodQ;
      if (prodRes.error) {
        let prodQ2 = supabase.from("produksi_v2").select("*")
          .gte("tanggal", startDate).lte("tanggal", endDate);
        if (shiftFilter !== "all") prodQ2 = prodQ2.eq("shift", Number(shiftFilter));
        prodRes = await prodQ2;
      }
      if (prodRes.data) prodList = prodRes.data;

      // 4. Fetch Downtime Log
      let dtList: any[] = [];
      let dtQ = supabase.from("downtime_log").select("*")
        .gte("tanggal", startDate).lte("tanggal", endDate);
      if (shiftFilter !== "all") dtQ = dtQ.eq("shift", Number(shiftFilter));
      let dtRes = await dtQ;
      if (dtRes.error) {
        let dtQ2 = supabase.from("downtime_v2").select("*")
          .gte("tanggal", startDate).lte("tanggal", endDate);
        if (shiftFilter !== "all") dtQ2 = dtQ2.eq("shift", Number(shiftFilter));
        dtRes = await dtQ2;
      }
      if (dtRes.data) dtList = dtRes.data;

      // 5. Fetch Safety Log
      let safetyList: any[] = [];
      const safetyRes = await supabase.from("safety_log").select("*")
        .gte("tanggal", startDate).lte("tanggal", endDate);
      if (safetyRes.data) safetyList = safetyRes.data;
      const accidentCount = safetyList.filter((s: any) => s.kategori === "ACCIDENT").length;
      const totalPeriodDays = periodMode === "harian" ? 1
        : Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
      setSafety({
        accident: accidentCount,
        hariTanpaAccident: accidentCount === 0 ? totalPeriodDays : 0,
      });

      // 6. Fetch Scrap (latest month in period)
      const scrapYear = periodMode === "tahunan" ? tahunPilih : new Date(endDate).getFullYear();
      const scrapMonth = periodMode === "tahunan" ? new Date().getMonth() + 1 : new Date(endDate).getMonth() + 1;
      const scrapRes = await supabase.from("scrap_top_end").select("*")
        .eq("tahun", scrapYear).eq("bulan", scrapMonth).maybeSingle();
      if (scrapRes.data) {
        setScrapValueRp((scrapRes.data.scrap_value_kidr || 0) * 1000);
      } else {
        setScrapValueRp(0);
      }

      // 7. Fetch Attendance
      let attList: any[] = [];
      let attQ = supabase.from("attendance_log").select("*")
        .gte("tanggal", startDate).lte("tanggal", endDate);
      if (shiftFilter !== "all") attQ = attQ.eq("shift", Number(shiftFilter));
      let attRes = await attQ;
      if (attRes.error) {
        let attQ2 = supabase.from("absensi_v2").select("*")
          .gte("tanggal", startDate).lte("tanggal", endDate);
        if (shiftFilter !== "all") attQ2 = attQ2.eq("shift", Number(shiftFilter));
        attRes = await attQ2;
      }
      if (attRes.data) attList = attRes.data;

      if (attList.length > 0) {
        const totOrang = attList.reduce((s: number, a: any) => s + (a.total_orang || 0), 0);
        const totHadir = attList.reduce((s: number, a: any) => s + (a.hadir || 0), 0);
        const totCuti = attList.reduce((s: number, a: any) => s + (a.cuti || 0), 0);
        const totAbsen = attList.reduce((s: number, a: any) => s + (a.absen || 0), 0);
        const totOT = attList.reduce((s: number, a: any) => s + (a.overtime_jam || 0), 0);
        const pctExclCuti = (totOrang - totCuti) > 0
          ? Math.min(100, Math.round((totHadir / (totOrang - totCuti)) * 100))
          : 0;
        setAttendance({
          pctExclCuti,
          total_orang: periodMode === "harian" ? totOrang : Math.round(totOrang / attList.length),
          hadir: periodMode === "harian" ? totHadir : Math.round(totHadir / attList.length),
          cuti: periodMode === "harian" ? totCuti : Math.round(totCuti / attList.length),
          absen: periodMode === "harian" ? totAbsen : Math.round(totAbsen / attList.length),
          overtime_jam: periodMode === "harian" ? totOT : Math.round(totOT / attList.length * 10) / 10,
        });
      } else {
        setAttendance({ pctExclCuti: 0, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      }

      // 8. Compute production totals
      let totalOK = 0, totalNG = 0, totalStroke = 0;
      let totalDowntime = 0, totalDandori = 0;
      let activeLinesCount = 0;
      const perMachineMap: Record<string, any> = {};
      MACHINES.forEach((m) => {
        perMachineMap[m.key] = { stroke: 0, ok: 0, ng: 0, downtime: 0, gsph: 0, targetGsph: 0, oee: 0, performanceFactor: 0, status: "OFFLINE" };
      });

      if (prodList.length > 0) {
        const activeMachinesSet = new Set<string>();
        const missingTarget: string[] = [];
        prodList.forEach((p: any) => {
          const mKey = p.mesin;
          activeMachinesSet.add(mKey);
          const ok = p.qty || p.ok_qty || 0;
          const ng = p.ng || p.ng_qty || 0;
          totalOK += ok;
          totalNG += ng;
          totalStroke += ok + ng;
          totalDandori += p.dandori_menit || 0;
          if (perMachineMap[mKey]) {
            perMachineMap[mKey].stroke += ok + ng;
            perMachineMap[mKey].ok += ok;
            perMachineMap[mKey].ng += ng;
            perMachineMap[mKey].status = "RUNNING";
            const tgsph = p.target_gsph || p.targetGsph || 0;
            perMachineMap[mKey].targetGsph = tgsph;
            if (!tgsph && !missingTarget.includes(mKey)) missingTarget.push(mKey);
          }
        });
        setMachinesTanpaTarget(missingTarget.map(k => MACHINES.find(m => m.key === k)?.label || k));
        activeLinesCount = activeMachinesSet.size;
      }

      if (dtList.length > 0) {
        const dtAgg: Record<string, number> = {};
        const katAgg: Record<string, number> = {};

        dtList.forEach((d: any) => {
          let mnt = d.durasi_menit || d.durasi || 0;
          if (!mnt && d.waktu_awal && d.waktu_akhir) {
            mnt = Math.round((new Date(d.waktu_akhir).getTime() - new Date(d.waktu_awal).getTime()) / 60000);
          }
          totalDowntime += mnt;
          if (perMachineMap[d.mesin]) {
            perMachineMap[d.mesin].downtime += mnt;
          }
          const probKey = d.problem || d.deskripsi || d.kategori || "Unspecified";
          dtAgg[probKey] = (dtAgg[probKey] || 0) + mnt;

          const katKey = d.kategori || "MESIN";
          katAgg[katKey] = (katAgg[katKey] || 0) + mnt;
        });

        const sortedPareto = Object.entries(dtAgg)
          .map(([problem, menit]) => ({
            problem, menit,
            pct: totalDowntime > 0 ? (menit / totalDowntime) * 100 : 0,
          }))
          .sort((a, b) => b.menit - a.menit)
          .slice(0, 5);
        setParetoDowntime(sortedPareto);

        const sortedKategori = Object.entries(katAgg)
          .map(([kategori, menit]) => ({
            kategori, menit,
            pct: totalDowntime > 0 ? (menit / totalDowntime) * 100 : 0,
          }))
          .sort((a, b) => b.menit - a.menit);
        setDowntimeKategori(sortedKategori);

        const top10 = [...dtList]
          .map((d: any) => {
            let mnt = d.durasi_menit || d.durasi || 0;
            return {
              mesin: d.mesin,
              mesinLabel: MACHINES.find((m) => m.key === d.mesin)?.label || d.mesin,
              kategori: d.kategori || "MESIN",
              problem: d.problem || d.deskripsi || "-",
              menit: mnt,
            };
          })
          .sort((a, b) => b.menit - a.menit)
          .slice(0, 10);
        setFleetTop10(top10);
      } else {
        setParetoDowntime([]);
        setFleetTop10([]);
        setDowntimeKategori([]);
      }

      // Compute GSPH & OEE per machine
      const workMins = 480;
      MACHINES.forEach((m) => {
        const md = perMachineMap[m.key];
        const gsph = Math.round(md.stroke / (workMins / 60));
        const tgsph = md.targetGsph || 500;
        const perf = tgsph > 0 ? Math.min(100, Math.round((gsph / tgsph) * 100)) : 0;
        const avail = Math.max(0, Math.round(100 - (md.downtime / workMins) * 100));
        const ngRate = md.stroke > 0 ? ((md.ng / md.stroke) * 100) : 0;
        const qual = Math.max(0, Math.round(100 - ngRate));
        const oeeVal = Math.round((perf / 100) * (avail / 100) * (qual / 100) * 100);
        perMachineMap[m.key] = { ...md, gsph, targetGsph: tgsph, performanceFactor: perf, oee: oeeVal };
      });

      const calcGsph = Math.round(totalStroke / (workMins / 60));
      const calcTargetGsph = 500;
      const perfFact = calcTargetGsph > 0 ? Math.min(100, Math.round((calcGsph / calcTargetGsph) * 100)) : 0;
      const avail = Math.max(0, Math.round(100 - (totalDowntime / (workMins * MACHINES.length)) * 100));
      const qual = totalStroke > 0 ? Math.max(0, Math.round(100 - (totalNG / totalStroke) * 100)) : 100;
      const oeeVal = Math.round((perfFact / 100) * (avail / 100) * (qual / 100) * 100);

      const ngValueRp = totalNG * 5000;

      setTotals({
        gsph: calcGsph, targetGsph: calcTargetGsph,
        performanceFactor: perfFact,
        okQty: totalOK, ng: totalNG, targetQty: totalOK + totalNG + 500,
        availability: avail, downtimeMenit: totalDowntime,
        stroke: totalStroke, dandoriMenit: totalDandori,
        oee: oeeVal, ngValueRp,
      });

      setMachineDataMap(perMachineMap);
      setLineAktif(activeLinesCount);
    } catch (err: any) {
      console.error("Dashboard error detail:", err?.message || JSON.stringify(err) || err);
    } finally {
      setLoading(false);
    }
  }, [periodMode, tanggal, bulanPilih, tahunPilih, shiftFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const ngRatePct = totals.stroke > 0 ? (totals.ng / totals.stroke) * 100 : 0;

  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(Number(n))) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  const statusClass = (data: any) => {
    if (data.status === "OFFLINE") return "status-idle";
    if (data.oee >= 85) return "status-running";
    if (data.oee >= 60) return "status-warn";
    return "status-stop";
  };
  const statusLabel = (data: any) => {
    if (data.status === "OFFLINE") return "OFFLINE";
    if (data.oee >= 85) return "RUNNING";
    if (data.oee >= 60) return "WARNING";
    return "STOP";
  };

  return (
    <HeaderNav activeTitle="Dashboard">
      {/* Topbar */}
      <div className="dash-topbar">
        <div className="dash-title-block">
          <h1>STAMPING PRODUCTION DASHBOARD</h1>
          <p>Monitoring &amp; Management Control</p>
        </div>
        <div className="dash-controls">
          <div className="perf-toggle-row" style={{ margin: 0 }}>
            <button type="button" className={`chip ${periodMode === "harian" ? "chip-active" : ""}`}
              onClick={() => setPeriodMode("harian")}>Harian</button>
            <button type="button" className={`chip ${periodMode === "bulanan" ? "chip-active" : ""}`}
              onClick={() => setPeriodMode("bulanan")}>Bulanan</button>
            <button type="button" className={`chip ${periodMode === "tahunan" ? "chip-active" : ""}`}
              onClick={() => setPeriodMode("tahunan")}>Tahunan</button>
          </div>

          {periodMode === "harian" && (
            <>
              <input type="date" value={tanggal}
                onChange={(e) => setTanggal(e.target.value)} />
              <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                <option value="all">Semua Shift</option>
                <option value="1">Shift 1 (07:00–19:30)</option>
                <option value="2">Shift 2 (19:30–07:00)</option>
              </select>
            </>
          )}

          {periodMode === "bulanan" && (
            <select value={bulanPilih} onChange={(e) => setBulanPilih(Number(e.target.value))}>
              {["Januari","Februari","Maret","April","Mei","Juni",
                "Juli","Agustus","September","Oktober","November","Desember"].map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          )}

          {(periodMode === "bulanan" || periodMode === "tahunan") && (
            <input type="number" min="2000" max="2100" style={{ maxWidth: "100px" }}
              value={tahunPilih} onChange={(e) => setTahunPilih(Number(e.target.value))} />
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Memuat data...</p>
      ) : (
        <div className="dash-body">
          {/* Warning: machines without target */}
          {machinesTanpaTarget.length > 0 && (
            <div className="error-msg">
              ⚠️ <b>Target GSPH belum diisi</b> untuk:{" "}
              <span>{machinesTanpaTarget.join(", ")}</span>.
              Akibatnya <b>Performance &amp; OEE tampil 0%</b>.
              Isi dulu di halaman mesin → tab <b>Master Data</b> → panel <b>Target GSPH</b> (khusus admin/leader).
            </div>
          )}

          {/* ══ 5 Kolom SQCPM ══ */}
          <SQCDMPPanel
            safety={safety}
            ngRatePct={ngRatePct}
            totalNG={totals.ng}
            oee={totals.oee}
            gsph={totals.gsph}
            targetGsph={totals.targetGsph}
            ngValueRp={totals.ngValueRp}
            scrapValueRp={scrapValueRp}
            attendance={attendance}
            periodMode={periodMode}
          />

          {/* ══ Grid TV (2 baris x 3 kolom) ══ */}
          <div className="tv-grid">
            {/* Baris 1: Trend GSPH | Pareto Downtime | Line Status Table */}
            <div className="dash-main-grid tv-row-1">
              {/* Trend GSPH Summary */}
              <div className="dash-panel">
                <p className="dash-panel-title">
                  Trend GSPH per {periodMode === "harian" ? "Jam" : periodMode === "bulanan" ? "Hari" : "Bulan"}
                </p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                  <span style={{ fontSize: "36px", fontWeight: 700, color: "var(--primary)" }}>
                    {fmtNum(totals.gsph)}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Target: {fmtNum(totals.targetGsph)} GSPH
                  </span>
                </div>
              </div>

              {/* Pareto Downtime */}
              <div className="dash-panel">
                <p className="dash-panel-title">Pareto Downtime (Menit)</p>
                {paretoDowntime.length > 0 ? (
                  <div>
                    {paretoDowntime.map((row) => (
                      <div className="pareto-row" key={row.problem}>
                        <span className="pareto-label" title={row.problem}>{row.problem}</span>
                        <div className="pareto-bar-track">
                          <div className="pareto-bar-fill" style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className="pareto-val">
                          {fmtNum(row.menit)} ({fmtNum(row.pct)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">Tidak ada downtime.</p>
                )}
              </div>

              {/* Line Status Table */}
              <div className="dash-panel">
                <p className="dash-panel-title">Line Status</p>
                <div className="table-wrap">
                  <table className="table-compact">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th>Stroke</th>
                        <th>Target</th>
                        <th>Actual</th>
                        <th>Perf</th>
                        <th>OEE</th>
                        <th>DT</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MACHINES.map((m) => {
                        const data = machineDataMap[m.key] || {
                          stroke: 0, gsph: 0, ng: 0, downtime: 0, status: "OFFLINE",
                          targetGsph: 0, performanceFactor: 0, oee: 0,
                        };
                        return (
                          <tr key={m.key}>
                            <td>
                              <Link href={`/machines/${m.slug}`} style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>
                                {m.label}
                              </Link>
                            </td>
                            <td className="mono">{fmtNum(data.stroke)}</td>
                            <td className="mono">{fmtNum(data.targetGsph)}</td>
                            <td className="mono">{fmtNum(data.gsph)}</td>
                            <td className="mono">{fmtNum(data.performanceFactor)}%</td>
                            <td className="mono">{fmtNum(data.oee)}%</td>
                            <td className="mono">{fmtNum(data.downtime)}m</td>
                            <td>
                              <span className={`status-badge ${statusClass(data)}`}>
                                {statusLabel(data)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Baris 2 (tv-row-3): Downtime Kategori | 10 Downtime Terburuk | OEE Breakdown */}
            <div className="dash-main-grid tv-row-3">
              {/* Downtime Kategori */}
              <div className="dash-panel">
                <p className="dash-panel-title">Downtime per Kategori</p>
                {downtimeKategori.length > 0 ? (
                  <div>
                    {downtimeKategori.map((row) => (
                      <div className="pareto-row" key={row.kategori}>
                        <span className="pareto-label" title={row.kategori}>{row.kategori}</span>
                        <div className="pareto-bar-track">
                          <div className="pareto-bar-fill" style={{ width: `${row.pct}%`, background: "var(--teal)" }} />
                        </div>
                        <span className="pareto-val">
                          {fmtNum(row.menit)} mnt
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">Tidak ada downtime.</p>
                )}
              </div>

              {/* 10 Downtime Terburuk */}
              <div className="dash-panel">
                <p className="dash-panel-title">10 Downtime Terburuk</p>
                <div className="table-wrap">
                  <table className="table-compact">
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
                          <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.problem}</td>
                          <td className="mono">{fmtNum(row.menit)}</td>
                        </tr>
                      ))}
                      {fleetTop10.length === 0 && (
                        <tr>
                          <td colSpan={4} className="empty-state">Tidak ada downtime.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OEE Breakdown */}
              <div className="dash-panel">
                <p className="dash-panel-title">OEE Breakdown</p>
                <div className="oee-donut-row oee-donut-row-3">
                  <div className="oee-donut-item">
                    <div className="oee-donut-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{fmtNum(totals.availability)}%</span>
                    </div>
                    <div className="oee-donut-label">Availability</div>
                  </div>
                  <div className="oee-donut-item">
                    <div className="oee-donut-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{fmtNum(totals.performanceFactor)}%</span>
                    </div>
                    <div className="oee-donut-label">Performance</div>
                  </div>
                  <div className="oee-donut-item">
                    <div className="oee-donut-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>
                        {fmtNum(totals.stroke > 0 ? Math.max(0, 100 - ngRatePct) : 100)}%
                      </span>
                    </div>
                    <div className="oee-donut-label">Quality</div>
                  </div>
                </div>
                <div className="oee-total-big">
                  <span className="oee-total-big-value">{fmtNum(totals.oee)}%</span>
                  <span className="oee-total-big-label">OEE Keseluruhan</span>
                </div>
                <p className="oee-kesimpulan">
                  {totals.oee >= 85
                    ? "✅ OEE dalam kondisi baik. Pertahankan performa ini."
                    : totals.oee >= 65
                    ? "⚠️ OEE perlu perhatian. Cek availability & downtime."
                    : "🔴 OEE rendah. Segera investigasi penyebab utama."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </HeaderNav>
  );
}
