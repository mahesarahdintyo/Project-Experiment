"use client";

import React from "react";

interface SQCDMPPanelProps {
  totals: {
    gsph: number;
    targetGsph: number;
    performanceFactor: number;
    okQty: number;
    ng: number;
    targetQty: number;
    availability: number;
    downtimeMenit: number;
  };
  ngRatePct: number;
  achievementPct: number;
  downtimePct: number;
  attendance: {
    pct: number;
    absen: number;
  };
}

export default function SQCDMPPanel({
  totals,
  ngRatePct,
  achievementPct,
  downtimePct,
  attendance,
}: SQCDMPPanelProps) {
  const cardStatus = (val: number, targetGreen: number, targetAmber: number) => {
    if (val >= targetGreen) return "green";
    if (val >= targetAmber) return "amber";
    return "red";
  };

  const cardLabel = (val: number, targetGreen: number, targetAmber: number) => {
    if (val >= targetGreen) return "GOOD";
    if (val >= targetAmber) return "WARNING";
    return "CRITICAL";
  };

  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  return (
    <div className="sqcdmp-grid">
      <div className={`sqcdmp-card sqcdmp-${cardStatus(totals.performanceFactor, 95, 80)}`}>
        <div className="sqcdmp-head"><span className="sqcdmp-icon">⚡</span>GSPH</div>
        <div className="sqcdmp-value">{fmtNum(totals.gsph)}</div>
        <div className="sqcdmp-sub">Target: <b>{fmtNum(totals.targetGsph)}</b></div>
        <div className="sqcdmp-badge">{cardLabel(totals.performanceFactor, 95, 80)}</div>
      </div>

      <div className={`sqcdmp-card sqcdmp-${cardStatus(100 - ngRatePct * 2, 90, 80)}`}>
        <div className="sqcdmp-head"><span className="sqcdmp-icon">🛡️</span>NG RATE</div>
        <div className="sqcdmp-value">{fmtNum(ngRatePct)}%</div>
        <div className="sqcdmp-sub">Target: ≤ 0.5% · <b>{fmtNum(totals.ng)}</b> pcs</div>
        <div className="sqcdmp-badge">{cardLabel(100 - ngRatePct * 2, 90, 80)}</div>
      </div>

      <div className={`sqcdmp-card sqcdmp-${cardStatus(achievementPct, 95, 80)}`}>
        <div className="sqcdmp-head"><span className="sqcdmp-icon">📈</span>PRODUCTIVITY</div>
        <div className="sqcdmp-value">{fmtNum(achievementPct)}%</div>
        <div className="sqcdmp-sub">Achievement vs Planning</div>
        <div className="sqcdmp-badge">{cardLabel(achievementPct, 95, 80)}</div>
      </div>

      <div className={`sqcdmp-card sqcdmp-${cardStatus(totals.availability, 95, 85)}`}>
        <div className="sqcdmp-head"><span className="sqcdmp-icon">✅</span>AVAILABILITY</div>
        <div className="sqcdmp-value">{fmtNum(totals.availability)}%</div>
        <div className="sqcdmp-sub">Target: ≥ 95%</div>
        <div className="sqcdmp-badge">{cardLabel(totals.availability, 95, 85)}</div>
      </div>

      <div className={`sqcdmp-card sqcdmp-${cardStatus(100 - downtimePct * 5, 90, 75)}`}>
        <div className="sqcdmp-head"><span className="sqcdmp-icon">⏱</span>DOWNTIME</div>
        <div className="sqcdmp-value">{fmtNum(totals.downtimeMenit)}</div>
        <div className="sqcdmp-sub">menit</div>
        <div className="sqcdmp-badge">{cardLabel(100 - downtimePct * 5, 90, 75)}</div>
      </div>

      <div className={`sqcdmp-card sqcdmp-${cardStatus(attendance.pct, 95, 85)}`}>
        <div className="sqcdmp-head"><span className="sqcdmp-icon">👥</span>MORALE</div>
        <div className="sqcdmp-value">{fmtNum(attendance.pct)}%</div>
        <div className="sqcdmp-sub">Attendance · <b>{fmtNum(attendance.absen)}</b> absen</div>
        <div className="sqcdmp-badge">{cardLabel(attendance.pct, 95, 85)}</div>
      </div>
    </div>
  );
}
