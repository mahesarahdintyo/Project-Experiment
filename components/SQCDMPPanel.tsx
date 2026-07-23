"use client";

import React from "react";

interface SQCPMProps {
  // Safety
  safety: {
    hariTanpaAccident: number;
    accident: number;
  };
  // Quality
  ngRatePct: number;
  totalNG: number;
  // Productivity
  oee: number;
  gsph: number;
  targetGsph: number;
  // Cost
  ngValueRp: number;
  scrapValueRp: number;
  // Moral / Attendance
  attendance: {
    pctExclCuti: number;
    total_orang: number;
    hadir: number;
    cuti: number;
    absen: number;
    overtime_jam: number;
  };
  // Mode
  periodMode?: "harian" | "bulanan" | "tahunan";
}

function cardStatus(val: number, good: number, warn: number): string {
  if (val >= good) return "good";
  if (val >= warn) return "warn";
  return "bad";
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function fmtRupiahShort(rp: number): string {
  if (!rp) return "Rp 0";
  if (rp >= 1_000_000_000) return `Rp ${(rp / 1_000_000_000).toFixed(1)}M`;
  if (rp >= 1_000_000) return `Rp ${(rp / 1_000_000).toFixed(1)}Jt`;
  if (rp >= 1_000) return `Rp ${(rp / 1_000).toFixed(0)}K`;
  return `Rp ${rp}`;
}

export default function SQCDMPPanel({
  safety,
  ngRatePct,
  totalNG,
  oee,
  gsph,
  targetGsph,
  ngValueRp,
  scrapValueRp,
  attendance,
  periodMode = "harian",
}: SQCPMProps) {
  const totalCostRp = ngValueRp + scrapValueRp;
  const costShareNG = totalCostRp > 0 ? (ngValueRp / totalCostRp) * 100 : 0;
  const costShareScrap = totalCostRp > 0 ? (scrapValueRp / totalCostRp) * 100 : 0;

  // Safety status: 0 accident = good
  const safetyStatus = safety.accident === 0 ? "good" : "bad";
  // Quality: NG Rate target ≤ 0.5%
  const qualityStatus = cardStatus(100 - ngRatePct * 2, 90, 80);
  // Productivity: OEE
  const prodStatus = cardStatus(oee, 95, 80);
  // Cost: lower cost = better (if 0 = good)
  const costStatus = totalCostRp === 0 ? "good" : totalCostRp < 1_000_000 ? "warn" : "bad";
  // Moral: attendance
  const moralStatus = cardStatus(attendance.pctExclCuti, 95, 85);

  return (
    <div className="sqcpm-columns">
      {/* ═══ SAFETY ═══ */}
      <div className={`sqcpm-col col-${safetyStatus}`}>
        <div className="sqcpm-col-head">
          <span className="sqcpm-col-icon">⛑️</span>
          <div>
            <div className="sqcpm-col-title">KESELAMATAN</div>
            <div className="sqcpm-col-sub">SAFETY</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">Hari Tanpa Kecelakaan</div>
        <div className="sqcpm-metric-value">{fmtNum(safety.hariTanpaAccident)}</div>
        <div className="sqcpm-bar">
          <div
            className="sqcpm-bar-fill"
            style={{ width: `${safety.accident === 0 ? 100 : 20}%` }}
          />
        </div>
        <div className="sqcpm-mini-label">{fmtNum(safety.accident)} insiden tercatat</div>
      </div>

      {/* ═══ QUALITY ═══ */}
      <div className={`sqcpm-col col-${qualityStatus}`}>
        <div className="sqcpm-col-head">
          <span className="sqcpm-col-icon">🎯</span>
          <div>
            <div className="sqcpm-col-title">KUALITAS</div>
            <div className="sqcpm-col-sub">QUALITY</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">NG Rate (Target ≤ 0,5%)</div>
        <div className="sqcpm-metric-value">{fmtNum(ngRatePct)}%</div>
        <div className="sqcpm-bar">
          <div
            className="sqcpm-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, 100 - ngRatePct * 20))}%` }}
          />
        </div>
        <div className="sqcpm-mini-label">{fmtNum(totalNG)} pcs NG</div>
      </div>

      {/* ═══ PRODUCTIVITY ═══ */}
      <div className={`sqcpm-col col-${prodStatus}`}>
        <div className="sqcpm-col-head">
          <span className="sqcpm-col-icon">⚙️</span>
          <div>
            <div className="sqcpm-col-title">PRODUKTIVITAS</div>
            <div className="sqcpm-col-sub">PRODUCTIVITY</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">OEE Keseluruhan</div>
        <div className="sqcpm-metric-value">{fmtNum(oee)}%</div>
        <div className="sqcpm-bar">
          <div
            className="sqcpm-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, oee))}%` }}
          />
        </div>
        <div className="sqcpm-mini-label">
          GSPH <b>{fmtNum(gsph)}</b> / target <b>{fmtNum(targetGsph)}</b>
        </div>
      </div>

      {/* ═══ COST ═══ */}
      <div className={`sqcpm-col col-${costStatus}`}>
        <div className="sqcpm-col-head">
          <span className="sqcpm-col-icon">💰</span>
          <div>
            <div className="sqcpm-col-title">BIAYA</div>
            <div className="sqcpm-col-sub">COST</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">Total Biaya</div>
        <div className="sqcpm-metric-value" style={{ fontSize: "22px" }}>
          {fmtRupiahShort(totalCostRp)}
        </div>
        <div className="cost-split">
          <div className="cost-split-row">
            <span className="cost-split-label">NG Inline</span>
            <span className="cost-split-value">{fmtRupiahShort(ngValueRp)}</span>
          </div>
          <div className="cost-split-bar">
            <div className="cost-split-fill cost-fill-ng" style={{ width: `${costShareNG}%` }} />
          </div>
          <div className="cost-split-row" style={{ marginTop: "6px" }}>
            <span className="cost-split-label">Scrap Top End</span>
            <span className="cost-split-value">{fmtRupiahShort(scrapValueRp)}</span>
          </div>
          <div className="cost-split-bar">
            <div className="cost-split-fill cost-fill-scrap" style={{ width: `${costShareScrap}%` }} />
          </div>
        </div>
      </div>

      {/* ═══ MORAL / ATTENDANCE ═══ */}
      <div className={`sqcpm-col col-${moralStatus}`}>
        <div className="sqcpm-col-head">
          <span className="sqcpm-col-icon">👥</span>
          <div>
            <div className="sqcpm-col-title">MORAL</div>
            <div className="sqcpm-col-sub">ATTENDANCE</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">
          Tingkat Kehadiran
          {periodMode !== "harian" && (
            <span className="avg-tag">rata-rata</span>
          )}
        </div>
        <div className="sqcpm-metric-value">{fmtNum(attendance.pctExclCuti)}%</div>
        <div className="sqcpm-bar">
          <div
            className="sqcpm-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, attendance.pctExclCuti))}%` }}
          />
        </div>
        <div className="manpower-grid manpower-grid-5">
          <div className="manpower-box">
            <span className="manpower-icon">👥</span>
            <span className="manpower-label">Total</span>
            <span className="manpower-value">{fmtNum(attendance.total_orang)}</span>
            <span className="manpower-unit">{periodMode === "harian" ? "Orang" : "/hari"}</span>
          </div>
          <div className="manpower-box manpower-hadir">
            <span className="manpower-icon">🧍</span>
            <span className="manpower-label">Hadir</span>
            <span className="manpower-value">{fmtNum(attendance.hadir)}</span>
            <span className="manpower-unit">{periodMode === "harian" ? "Orang" : "/hari"}</span>
          </div>
          <div className="manpower-box">
            <span className="manpower-icon">🌴</span>
            <span className="manpower-label">Cuti</span>
            <span className="manpower-value">{fmtNum(attendance.cuti)}</span>
            <span className="manpower-unit">{periodMode === "harian" ? "Orang" : "/hari"}</span>
          </div>
          <div className="manpower-box">
            <span className="manpower-icon">🚫</span>
            <span className="manpower-label">Absen</span>
            <span className="manpower-value">{fmtNum(attendance.absen)}</span>
            <span className="manpower-unit">{periodMode === "harian" ? "Orang" : "/hari"}</span>
          </div>
          <div className="manpower-box">
            <span className="manpower-icon">⏰</span>
            <span className="manpower-label">O.T</span>
            <span className="manpower-value">{fmtNum(attendance.overtime_jam)}</span>
            <span className="manpower-unit">Jam</span>
          </div>
        </div>
      </div>
    </div>
  );
}
