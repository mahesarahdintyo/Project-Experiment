"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import SQCDMPPanel from "@/components/SQCDMPPanel";
import { supabase } from "@/lib/supabaseClient";
import { Profile } from "@/types/database";
import Chart from "chart.js/auto";

const MACHINES = [
  { key: "tandem",        label: "Tandem",        slug: "tandem",        defaultTarget: 415  },
  { key: "blanking",      label: "Blanking",      slug: "blanking",      defaultTarget: 1888 },
  { key: "transfer_2000t", label: "Transfer 2000t", slug: "transfer-2000t", defaultTarget: 868 },
  { key: "transfer_800t", label: "Transfer 800t", slug: "transfer-800t", defaultTarget: 975  },
  { key: "pc200t",        label: "PC200t",        slug: "pc200t",        defaultTarget: 420  },
];

export default function DashboardPage() {
  const [loading,      setLoading]      = useState(true);
  const [periodMode,   setPeriodMode]   = useState<"harian" | "bulanan" | "tahunan">("harian");
  const [tanggal,      setTanggal]      = useState(new Date().toISOString().split("T")[0]);
  const [bulanPilih,   setBulanPilih]   = useState(new Date().getMonth());
  const [tahunPilih,   setTahunPilih]   = useState(new Date().getFullYear());
  const [shiftFilter,  setShiftFilter]  = useState("all");

  const [profile,          setProfile]          = useState<Profile | null>(null);
  const [paretoDowntime,   setParetoDowntime]   = useState<any[]>([]);
  const [fleetTop10,       setFleetTop10]       = useState<any[]>([]);
  const [machineDataMap,   setMachineDataMap]   = useState<Record<string, any>>({});

  const [totals, setTotals] = useState({
    gsph: 0, targetGsph: 0, performanceFactor: 0,
    okQty: 0, ng: 0, targetQty: 0,
    availability: 0, downtimeMenit: 0,
    stroke: 0, dandoriMenit: 0, oee: 0,
    ngValueRp: 0,
  });

  const [safety,      setSafety]      = useState({ hariTanpaAccident: 0, accident: 0 });
  const [scrapValueRp, setScrapValueRp] = useState(0);
  const [attendance,  setAttendance]  = useState({
    pctExclCuti: 0, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0,
  });

  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const hourlyCanvasRef  = useRef<HTMLCanvasElement | null>(null);
  const fleetCanvasRef   = useRef<HTMLCanvasElement | null>(null);
  const donutAvailRef    = useRef<HTMLCanvasElement | null>(null);
  const donutPerfRef     = useRef<HTMLCanvasElement | null>(null);
  const donutQualRef     = useRef<HTMLCanvasElement | null>(null);
  const chartInstances   = useRef<Record<string, Chart>>({});

  /* ── Theme ───────────────────────────────────────────── */
  useEffect(() => {
    const saved = (localStorage.getItem("theme_v1") as "light" | "dark") || "dark";
    setTheme(saved);
    const handler = () => setTheme((localStorage.getItem("theme_v1") as "light" | "dark") || "dark");
    window.addEventListener("themeChange", handler);
    return () => window.removeEventListener("themeChange", handler);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme_v1", next);
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event("themeChange"));
  };

  /* ── Fetch ───────────────────────────────────────────── */
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        if (profData) setProfile(profData as Profile);
      }

      let startDate = tanggal;
      let endDate   = tanggal;
      if (periodMode === "bulanan") {
        const yr = tahunPilih, mo = bulanPilih;
        startDate = `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(yr, mo + 1, 0).getDate();
        endDate   = `${yr}-${String(mo + 1).padStart(2, "0")}-${lastDay}`;
      } else if (periodMode === "tahunan") {
        startDate = `${tahunPilih}-01-01`;
        endDate   = `${tahunPilih}-12-31`;
      }

      /* Production */
      let prodList: any[] = [];
      let pq = supabase.from("production_log").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
      if (shiftFilter !== "all") pq = pq.eq("shift", Number(shiftFilter));
      let pr = await pq;
      if (pr.error) {
        let pq2 = supabase.from("produksi_v2").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
        if (shiftFilter !== "all") pq2 = pq2.eq("shift", Number(shiftFilter));
        pr = await pq2;
      }
      if (pr.data) prodList = pr.data;

      /* Downtime */
      let dtList: any[] = [];
      let dq = supabase.from("downtime_log").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
      if (shiftFilter !== "all") dq = dq.eq("shift", Number(shiftFilter));
      let dr = await dq;
      if (dr.error) {
        let dq2 = supabase.from("downtime_v2").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
        if (shiftFilter !== "all") dq2 = dq2.eq("shift", Number(shiftFilter));
        dr = await dq2;
      }
      if (dr.data) dtList = dr.data;

      /* Safety */
      let accidentCount = 0, daysWithoutAccident = 0;
      try {
        const sr = await supabase.from("safety_log").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
        if (sr.data && sr.data.length > 0) {
          accidentCount = sr.data.filter((s: any) => s.kategori === "ACCIDENT").length;
          const totalDays = periodMode === "harian" ? 1
            : Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
          daysWithoutAccident = accidentCount === 0 ? totalDays : 0;
        }
      } catch { /* table not yet created */ }
      setSafety({ accident: accidentCount, hariTanpaAccident: daysWithoutAccident });

      /* Scrap */
      try {
        const scrapYear  = periodMode === "tahunan" ? tahunPilih : new Date(endDate).getFullYear();
        const scrapMonth = periodMode === "tahunan" ? new Date().getMonth() + 1 : new Date(endDate).getMonth() + 1;
        const sr = await supabase.from("scrap_top_end").select("*").eq("tahun", scrapYear).eq("bulan", scrapMonth).maybeSingle();
        setScrapValueRp(sr.data ? (sr.data.scrap_value_kidr || 0) * 1000 : 0);
      } catch { setScrapValueRp(0); }

      /* Attendance */
      let attList: any[] = [];
      try {
        let aq = supabase.from("attendance_log").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
        if (shiftFilter !== "all") aq = aq.eq("shift", Number(shiftFilter));
        let ar = await aq;
        if (ar.error) {
          let aq2 = supabase.from("absensi_v2").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
          if (shiftFilter !== "all") aq2 = aq2.eq("shift", Number(shiftFilter));
          ar = await aq2;
        }
        if (ar.data) attList = ar.data;
      } catch { attList = []; }

      if (attList.length > 0) {
        const totOrang = attList.reduce((s: number, a: any) => s + (a.total_orang || 0), 0);
        const totHadir = attList.reduce((s: number, a: any) => s + (a.hadir        || 0), 0);
        const totCuti  = attList.reduce((s: number, a: any) => s + (a.cuti         || 0), 0);
        const totAbsen = attList.reduce((s: number, a: any) => s + (a.absen        || 0), 0);
        const totOT    = attList.reduce((s: number, a: any) => s + (a.overtime_jam || 0), 0);
        const pct = (totOrang - totCuti) > 0 ? Math.min(100, Math.round((totHadir / (totOrang - totCuti)) * 1000) / 10) : 0;
        const n   = attList.length;
        setAttendance({
          pctExclCuti: pct,
          total_orang: periodMode === "harian" ? totOrang : Math.round(totOrang / n),
          hadir:       periodMode === "harian" ? totHadir : Math.round(totHadir / n),
          cuti:        periodMode === "harian" ? totCuti  : Math.round(totCuti  / n),
          absen:       periodMode === "harian" ? totAbsen : Math.round(totAbsen / n),
          overtime_jam:periodMode === "harian" ? totOT    : Math.round(totOT    / n * 10) / 10,
        });
      } else {
        setAttendance({ pctExclCuti: 0, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      }

      /* Compute production/downtime aggregates */
      let totalOK = 0, totalNG = 0, totalStroke = 0, totalDowntime = 0, totalDandori = 0;
      const perMachineMap: Record<string, any> = {};
      MACHINES.forEach((m) => {
        perMachineMap[m.key] = { stroke: 0, ok: 0, ng: 0, downtime: 0, gsph: 0, targetGsph: m.defaultTarget, oee: 0, performanceFactor: 0, status: "OFFLINE" };
      });

      if (prodList.length > 0) {
        prodList.forEach((p: any) => {
          const ok = p.qty || p.ok_qty || 0;
          const ng = p.ng  || p.ng_qty  || 0;
          totalOK     += ok;
          totalNG     += ng;
          totalStroke += ok + ng;
          totalDandori += p.dandori_menit || 0;
          if (perMachineMap[p.mesin]) {
            perMachineMap[p.mesin].stroke     += ok + ng;
            perMachineMap[p.mesin].ok         += ok;
            perMachineMap[p.mesin].ng         += ng;
            perMachineMap[p.mesin].status      = "RUNNING";
            perMachineMap[p.mesin].targetGsph  = p.target_gsph || p.targetGsph || perMachineMap[p.mesin].targetGsph;
          }
        });
      }

      if (dtList.length > 0) {
        const dtAgg: Record<string, number> = {};
        dtList.forEach((d: any) => {
          let mnt = d.durasi_menit || d.durasi || 0;
          if (!mnt && d.waktu_awal && d.waktu_akhir)
            mnt = Math.round((new Date(d.waktu_akhir).getTime() - new Date(d.waktu_awal).getTime()) / 60000);
          totalDowntime += mnt;
          if (perMachineMap[d.mesin]) perMachineMap[d.mesin].downtime += mnt;
          const probKey = d.problem || d.deskripsi || d.kategori || "Unspecified";
          dtAgg[probKey] = (dtAgg[probKey] || 0) + mnt;
        });

        setParetoDowntime(
          Object.entries(dtAgg)
            .map(([problem, menit]) => ({ problem, menit, pct: totalDowntime > 0 ? (menit / totalDowntime) * 100 : 0 }))
            .sort((a, b) => b.menit - a.menit)
            .slice(0, 5)
        );
        setFleetTop10(
          [...dtList]
            .map((d: any) => ({
              mesin: d.mesin,
              mesinLabel: MACHINES.find((m) => m.key === d.mesin)?.label || d.mesin,
              kategori: d.kategori || "MESIN",
              problem:  d.problem  || d.deskripsi || "-",
              menit:    d.durasi_menit || d.durasi || 0,
            }))
            .sort((a, b) => b.menit - a.menit)
            .slice(0, 10)
        );
      } else {
        setParetoDowntime([]);
        setFleetTop10([]);
      }

      const workMins = 480;
      MACHINES.forEach((m) => {
        const md   = perMachineMap[m.key];
        const gsph = Math.round(md.stroke / (workMins / 60));
        const tgsph = md.targetGsph;
        const perf  = tgsph > 0 ? Math.min(100, Math.round((gsph / tgsph) * 100)) : 0;
        const avail = md.stroke > 0 || md.downtime > 0 ? Math.max(0, Math.round(100 - (md.downtime / workMins) * 100)) : 0;
        const qual  = md.stroke > 0 ? Math.max(0, Math.round(100 - (md.ng / md.stroke) * 100)) : 0;
        perMachineMap[m.key] = { ...md, gsph, targetGsph: tgsph, performanceFactor: perf, oee: Math.round((perf / 100) * (avail / 100) * (qual / 100) * 100) };
      });

      const calcGsph  = Math.round(totalStroke / (workMins / 60));
      const perfFact  = 0;
      const avail     = totalStroke > 0 || totalDowntime > 0 ? Math.max(0, Math.round(100 - (totalDowntime / (workMins * MACHINES.length)) * 100)) : 0;
      const qual      = totalStroke > 0 ? Math.max(0, Math.round(100 - (totalNG / totalStroke) * 100)) : 0;

      setTotals({ gsph: calcGsph, targetGsph: 0, performanceFactor: perfFact, okQty: totalOK, ng: totalNG, targetQty: totalOK + totalNG + 500, availability: avail, downtimeMenit: totalDowntime, stroke: totalStroke, dandoriMenit: totalDandori, oee: Math.round((perfFact / 100) * (avail / 100) * (qual / 100) * 100), ngValueRp: totalNG * 5000 });
      setMachineDataMap(perMachineMap);
    } catch (err: any) {
      console.error("Dashboard error:", err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [periodMode, tanggal, bulanPilih, tahunPilih, shiftFilter]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const ngRatePct = totals.stroke > 0 ? (totals.ng / totals.stroke) * 100 : 0;

  /* ── Charts ──────────────────────────────────────────── */
  useEffect(() => {
    if (loading) return;

    /* Trend GSPH (no x-axis ticks) */
    if (hourlyCanvasRef.current) {
      if (chartInstances.current.hourly) chartInstances.current.hourly.destroy();
      const lineColors = ["#3b82f6", "#38bdf8", "#818cf8", "#2dd4bf", "#94a3b8"];
      const hours = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];
      chartInstances.current.hourly = new Chart(hourlyCanvasRef.current, {
        type: "line",
        data: {
          labels: hours,
          datasets: MACHINES.map((m, idx) => ({
            label: m.label,
            data: hours.map(() => null),
            borderColor: lineColors[idx % lineColors.length],
            backgroundColor: "transparent",
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              align: "end",
              labels: { color: "#94a3b8", boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", font: { size: 10 } },
            },
          },
          scales: {
            x: { ticks: { display: false }, grid: { display: false }, border: { display: false } },
            y: {
              ticks: { color: "#64748b", font: { size: 10 }, stepSize: 0.5 },
              grid: { color: "#334155" },
              border: { display: false },
              beginAtZero: true,
              max: 1.0,
            },
          },
        },
      });
    }

    /* Downtime per Kategori × Line (Stacked Bar) */
    if (fleetCanvasRef.current) {
      if (chartInstances.current.fleet) chartInstances.current.fleet.destroy();
      const categories = ["MESIN", "DIES", "FINGER", "OTHER"];
      const catColors: Record<string, string> = { MESIN: "#3b82f6", DIES: "#ef4444", FINGER: "#22c55e", OTHER: "#38bdf8" };
      chartInstances.current.fleet = new Chart(fleetCanvasRef.current, {
        type: "bar",
        data: {
          labels: MACHINES.map((m) => m.label),
          datasets: categories.map((cat) => ({
            label: cat,
            data: MACHINES.map(() => 0),
            backgroundColor: catColors[cat],
            borderRadius: 4,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: { color: "#94a3b8", boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", font: { size: 10 } },
            },
          },
          scales: {
            x: { stacked: true, ticks: { color: "#64748b", font: { size: 10 } }, grid: { display: false }, border: { display: false } },
            y: {
              stacked: true,
              ticks: { color: "#64748b", font: { size: 10 }, stepSize: 0.5 },
              grid: { color: "#334155" },
              border: { display: false },
              beginAtZero: true,
              max: 1.0,
            },
          },
        },
      });
    }

    /* Donuts OEE */
    const getCssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

    const renderDonut = (canvas: HTMLCanvasElement | null, id: string, val: number, color: string) => {
      if (!canvas) return;
      if (chartInstances.current[id]) chartInstances.current[id].destroy();
      const v = Math.max(0, Math.min(100, val));
      chartInstances.current[id] = new Chart(canvas, {
        type: "doughnut",
        data: { datasets: [{ data: [v, 100 - v], backgroundColor: [color, getCssVar("--panel-2") || "#1e293b"], borderWidth: 0 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          ...(({ cutout: "72%" } as any)),
        },
      });
    };

    renderDonut(donutAvailRef.current, "donutAvail", totals.availability,       getCssVar("--sky")  || "#38bdf8");
    renderDonut(donutPerfRef.current,  "donutPerf",  totals.performanceFactor,  getCssVar("--teal") || "#2563eb");
    renderDonut(donutQualRef.current,  "donutQual",  totals.stroke > 0 ? Math.max(0, 100 - ngRatePct) : 0, getCssVar("--navy") || "#2563eb");

    return () => { Object.values(chartInstances.current).forEach((c) => c.destroy()); };
  }, [loading, totals, ngRatePct]);

  /* ── Helpers ─────────────────────────────────────────── */
  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(Number(n))) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  /* Smart OEE conclusion — mirrors vanilla oeeKesimpulan() */
  const oeeKesimpulan = (): string => {
    const a = totals.availability;
    const p = totals.performanceFactor;
    const q = totals.stroke > 0 ? Math.max(0, 100 - ngRatePct) : 0;
    const oee = totals.oee;
    if (oee === 0 && a === 0 && p === 0) return "Belum ada data produksi pada periode ini.";
    const faktor = [
      { nama: "Availability",  val: a, saran: "kurangi downtime & dandori" },
      { nama: "Performance",   val: p, saran: "kejar GSPH mendekati target" },
      { nama: "Quality",       val: q, saran: "tekan angka NG" },
    ];
    const terlemah = faktor.reduce((acc, cur) => (cur.val < acc.val ? cur : acc));
    const level = oee >= 75 ? "baik" : oee >= 50 ? "cukup" : "perlu perhatian";
    let s = `OEE ${fmtNum(oee)}% (${level}). `;
    if (terlemah.val >= 95) {
      s += "Ketiga faktor sudah tinggi dan seimbang.";
    } else {
      s += `Faktor terlemah: ${terlemah.nama} ${fmtNum(terlemah.val)}% — ${terlemah.saran}.`;
    }
    return s;
  };
  const statusClass = (d: any) => d.status === "OFFLINE" ? "status-idle" : d.oee >= 75 ? "status-running" : d.oee >= 50 ? "status-warn" : "status-stop";
  const statusLabel = (d: any) => d.status === "OFFLINE" ? "OFF" : d.oee >= 75 ? "GOOD" : d.oee >= 50 ? "FAIR" : "POOR";

  /* ── Render ──────────────────────────────────────────── */
  return (
    <HeaderNav activeTitle="Dashboard">
      {/* Topbar ──────────────────────────────────────────── */}
      <div className="dash-topbar">
        <div className="dash-title-block">
          <h1>STAMPING PRODUCTION DASHBOARD</h1>
          <p>Monitoring &amp; Management Control</p>
        </div>
        <div className="dash-controls">
          <div className="perf-toggle-row" style={{ margin: 0 }}>
            <button type="button" className={`chip ${periodMode === "harian"  ? "chip-active" : ""}`} onClick={() => setPeriodMode("harian")}>Harian</button>
            <button type="button" className={`chip ${periodMode === "bulanan" ? "chip-active" : ""}`} onClick={() => setPeriodMode("bulanan")}>Bulanan</button>
            <button type="button" className={`chip ${periodMode === "tahunan" ? "chip-active" : ""}`} onClick={() => setPeriodMode("tahunan")}>Tahunan</button>
          </div>

          {periodMode === "harian" && (
            <>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                <option value="all">Semua Shift</option>
                <option value="1">Shift 1</option>
                <option value="2">Shift 2</option>
              </select>
            </>
          )}
          {periodMode === "bulanan" && (
            <select value={bulanPilih} onChange={(e) => setBulanPilih(Number(e.target.value))}>
              {["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          )}
          {(periodMode === "bulanan" || periodMode === "tahunan") && (
            <input type="number" min="2000" max="2100" style={{ maxWidth: "90px" }} value={tahunPilih} onChange={(e) => setTahunPilih(Number(e.target.value))} />
          )}

          <button className="theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Memuat data...</p>
      ) : (
        <div className="dash-body">
          {/* ═══ SQCPM 5-column strip ═══ */}
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

          {/* ═══ TV Grid (2 rows × 3 cols) ═══ */}
          <div className="tv-grid">

            {/* Row 1 */}
            <div className="dash-main-grid tv-row-1">

              {/* Trend GSPH */}
              <div className="dash-panel">
                <p className="dash-panel-title">
                  TREND GSPH PER {periodMode === "harian" ? "JAM" : periodMode === "bulanan" ? "HARI" : "BULAN"}
                </p>
                <div className="dash-chart-sm">
                  <canvas ref={hourlyCanvasRef} />
                </div>
              </div>

              {/* Pareto Downtime */}
              <div className="dash-panel">
                <p className="dash-panel-title">PARETO DOWNTIME (MENIT)</p>
                {paretoDowntime.length > 0 ? (
                  <div style={{ flex: 1 }}>
                    {paretoDowntime.map((row) => (
                      <div className="pareto-row" key={row.problem}>
                        <span className="pareto-label" title={row.problem}>{row.problem}</span>
                        <div className="pareto-bar-track">
                          <div className="pareto-bar-fill" style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className="pareto-val">{fmtNum(row.menit)} ({fmtNum(row.pct)}%)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dash-empty-center">
                    <span>Tidak ada downtime.</span>
                  </div>
                )}
              </div>

              {/* Line Status */}
              <div className="dash-panel">
                <p className="dash-panel-title">LINE STATUS</p>
                <div className="table-wrap">
                  <table className="table-compact">
                    <thead>
                      <tr>
                        <th>LINE</th>
                        <th>STROKE</th>
                        <th>TARGET</th>
                        <th>ACTUAL</th>
                        <th>PERF</th>
                        <th>OEE</th>
                        <th>DT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MACHINES.map((m) => {
                        const d = machineDataMap[m.key] || {
                          stroke: 0, gsph: 0, ng: 0, downtime: 0, status: "OFFLINE",
                          targetGsph: m.defaultTarget, performanceFactor: 0, oee: 0,
                        };
                        return (
                          <tr key={m.key}>
                            <td>
                              <Link href={`/machines/${m.slug}`} style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                                {m.label}
                              </Link>
                            </td>
                            <td className="mono">{fmtNum(d.stroke)}</td>
                            <td className="mono">{fmtNum(d.targetGsph)}</td>
                            <td className="mono">{fmtNum(d.gsph)}</td>
                            <td className="mono">{fmtNum(d.performanceFactor)}%</td>
                            <td className="mono">{fmtNum(d.oee)}%</td>
                            <td className="mono">{fmtNum(d.downtime)}</td>
                            <td><span className={`status-badge ${statusClass(d)}`}>{statusLabel(d)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="dash-main-grid tv-row-3">

              {/* Downtime per Kategori */}
              <div className="dash-panel">
                <p className="dash-panel-title">DOWNTIME PER KATEGORI × LINE</p>
                <div className="dash-chart-sm">
                  <canvas ref={fleetCanvasRef} />
                </div>
              </div>

              {/* 10 Downtime Terburuk */}
              <div className="dash-panel" style={{ display: "flex", flexDirection: "column" }}>
                <p className="dash-panel-title">10 DOWNTIME TERBURUK</p>
                <div className="table-wrap" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <table className="table-compact" style={{ width: "100%", height: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>LINE</th>
                        <th style={{ width: "25%" }}>KATEGORI</th>
                        <th style={{ width: "38%" }}>PROBLEM</th>
                        <th style={{ width: "15%" }}>MENIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetTop10.length > 0 ? (
                        fleetTop10.map((row, idx) => (
                          <tr key={idx}>
                            <td><span className="badge">{row.mesinLabel}</span></td>
                            <td>{row.kategori}</td>
                            <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.problem}</td>
                            <td className="mono">{fmtNum(row.menit)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="empty-state"
                            style={{
                              padding: "40px 10px",
                              verticalAlign: "middle",
                              textAlign: "center",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Tidak ada downtime.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OEE Breakdown */}
              <div className="dash-panel">
                <p className="dash-panel-title">OEE BREAKDOWN</p>

                <div className="oee-donut-row oee-donut-row-3">
                  <div className="oee-donut-item">
                    <div className="oee-donut-wrap"><canvas ref={donutAvailRef} /></div>
                    <div className="oee-donut-label">Availability</div>
                  </div>
                  <div className="oee-donut-item">
                    <div className="oee-donut-wrap"><canvas ref={donutPerfRef} /></div>
                    <div className="oee-donut-label">Performance</div>
                  </div>
                  <div className="oee-donut-item">
                    <div className="oee-donut-wrap"><canvas ref={donutQualRef} /></div>
                    <div className="oee-donut-label">Quality</div>
                  </div>
                </div>

                <div className="oee-total-big">
                  <span className="oee-total-big-value">{fmtNum(totals.oee)}%</span>
                  <span className="oee-total-big-label">OEE Keseluruhan</span>
                </div>

                <p className="oee-kesimpulan">{oeeKesimpulan()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </HeaderNav>
  );
}
