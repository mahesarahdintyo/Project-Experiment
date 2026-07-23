"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import HeaderNav from "@/components/HeaderNav";
import DowntimeModal from "@/components/DowntimeModal";
import AttendanceModal from "@/components/AttendanceModal";
import NonProduksiModal from "@/components/NonProduksiModal";
import { supabase } from "@/lib/supabaseClient";
import {
  MachineConfig,
  MasterPart,
  ProductionRecord,
  DowntimeRecord,
  NonProduksiRecord,
  AttendanceRecord,
} from "@/types/database";

const MACHINE_CONFIGS: Record<string, MachineConfig> = {
  blanking: {
    slug: "blanking",
    key: "blanking",
    label: "Blanking",
    extraFields: [
      { key: "top_coil", label: "Top Coil", type: "text" },
      { key: "berat_coil", label: "Berat Coil (kg)", type: "number" },
    ],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "OTHER"],
    stationConfig: { mode: "none" },
  },
  pc200t: {
    slug: "pc200t",
    key: "pc200t",
    label: "PC200t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "OTHER"],
    stationConfig: { mode: "fixed", stations: ["PC-1", "PC-2"] },
  },
  tandem: {
    slug: "tandem",
    key: "tandem",
    label: "Tandem",
    extraFields: [],
    routingMax: 8,
    kategoriOptions: ["MESIN", "DIES", "OTHER"],
    stationConfig: {
      mode: "variant",
      variants: {
        lama: ["PA-1", "PA-2", "PA-3", "PA-4", "PA-5"],
        baru: ["PA-6", "PA-7", "PA-8", "PA-9", "PA-10"],
      },
    },
  },
  "transfer-2000t": {
    slug: "transfer-2000t",
    key: "transfer_2000t",
    label: "Transfer 2000t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
  "transfer-800t": {
    slug: "transfer-800t",
    key: "transfer_800t",
    label: "Transfer 800t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function MachineDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug || "tandem";

  const config = MACHINE_CONFIGS[slug] || MACHINE_CONFIGS["tandem"];

  const [activeTab, setActiveTab] = useState<"produksi" | "downtime" | "non_produksi" | "master_data">("produksi");
  const [loading, setLoading] = useState(true);

  // Filter State
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [shift, setShift] = useState(1);

  // Live Timer State
  const [isLive, setIsLive] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [dandoriMinutes, setDandoriMinutes] = useState(0);

  // Form State
  const [selectedPart, setSelectedPart] = useState("");
  const [okQty, setOkQty] = useState<number | "">("");
  const [ngQty, setNgQty] = useState<number | "">(0);
  const [nextProcess, setNextProcess] = useState("");
  const [routingNo, setRoutingNo] = useState(1);
  const [extraValues, setExtraValues] = useState<Record<string, any>>({});

  // Modals
  const [isDowntimeOpen, setIsDowntimeOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isNonProduksiOpen, setIsNonProduksiOpen] = useState(false);

  // Data lists
  const [masterParts, setMasterParts] = useState<MasterPart[]>([]);
  const [produksiList, setProduksiList] = useState<ProductionRecord[]>([]);
  const [downtimeList, setDowntimeList] = useState<DowntimeRecord[]>([]);
  const [nonProduksiList, setNonProduksiList] = useState<NonProduksiRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);

  // Data Loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Master Parts
      const { data: parts } = await supabase
        .from("master_part")
        .select("*")
        .eq("mesin", config.key);
      if (parts) setMasterParts(parts as MasterPart[]);

      // 2. Fetch Production Log
      const { data: prod } = await supabase
        .from("produksi_v2")
        .select("*")
        .eq("mesin", config.key)
        .eq("tanggal", tanggal)
        .eq("shift", shift)
        .order("created_at", { ascending: false });
      if (prod) setProduksiList(prod as ProductionRecord[]);

      // 3. Fetch Downtime Log
      const { data: dt } = await supabase
        .from("downtime_v2")
        .select("*")
        .eq("mesin", config.key)
        .eq("tanggal", tanggal)
        .eq("shift", shift)
        .order("created_at", { ascending: false });
      if (dt) setDowntimeList(dt as DowntimeRecord[]);

      // 4. Fetch Non-Produksi Log
      const { data: np } = await supabase
        .from("non_produksi_v2")
        .select("*")
        .eq("mesin", config.key)
        .eq("tanggal", tanggal)
        .eq("shift", shift)
        .order("created_at", { ascending: false });
      if (np) setNonProduksiList(np as NonProduksiRecord[]);

      // 5. Fetch Attendance
      const { data: att } = await supabase
        .from("absensi_v2")
        .select("*")
        .eq("mesin", config.key)
        .eq("tanggal", tanggal)
        .eq("shift", shift)
        .maybeSingle();
      if (att) setAttendance(att as AttendanceRecord);
    } catch (err) {
      console.error("Machine load error:", err);
    } finally {
      setLoading(false);
    }
  }, [config.key, tanggal, shift]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Start Live Batch
  const handleStartBatch = () => {
    setIsLive(true);
    setStartTime(new Date().toISOString());
  };

  // Stop Live Batch & Save Record
  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart || okQty === "") return;

    try {
      const endTime = new Date().toISOString();
      const payload: ProductionRecord = {
        tanggal,
        shift,
        mesin: config.key,
        part_name: selectedPart,
        waktu_mulai: startTime || new Date().toISOString(),
        waktu_selesai: endTime,
        ok_qty: Number(okQty),
        ng_qty: Number(ngQty) || 0,
        dandori_menit: dandoriMinutes,
        next_process: nextProcess,
        routing_no: config.routingMax > 0 ? routingNo : undefined,
        top_coil: extraValues.top_coil,
        berat_coil: extraValues.berat_coil ? Number(extraValues.berat_coil) : undefined,
      };

      const { error } = await supabase.from("produksi_v2").insert(payload);
      if (error) throw error;

      alert("Data produksi berhasil disimpan!");
      setIsLive(false);
      setStartTime(null);
      setOkQty("");
      setNgQty(0);
      setDandoriMinutes(0);
      loadData();
    } catch (err: any) {
      alert("Gagal menyimpan produksi: " + err.message);
    }
  };

  // Save Downtime Modal Callback
  const handleSaveDowntime = async (data: { kategori: string; deskripsi: string; durasi_menit: number; station?: string }) => {
    try {
      const { error } = await supabase.from("downtime_v2").insert({
        mesin: config.key,
        tanggal,
        shift,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        durasi_menit: data.durasi_menit,
        station: data.station,
      });
      if (error) throw error;
      alert("Catatan Downtime berhasil disimpan!");
      loadData();
    } catch (err: any) {
      alert("Gagal menyimpan downtime: " + err.message);
    }
  };

  // Save Non-Produksi Callback
  const handleSaveNonProduksi = async (data: { kegiatan: string; durasi_menit: number; keterangan?: string }) => {
    try {
      const { error } = await supabase.from("non_produksi_v2").insert({
        mesin: config.key,
        tanggal,
        shift,
        kegiatan: data.kegiatan,
        durasi_menit: data.durasi_menit,
        keterangan: data.keterangan,
      });
      if (error) throw error;
      alert("Catatan Jam Non-Produksi disimpan!");
      loadData();
    } catch (err: any) {
      alert("Gagal menyimpan non-produksi: " + err.message);
    }
  };

  // Save Attendance Callback
  const handleSaveAttendance = async (data: { tanggal: string; shift: number; mp_hadir: number; mp_absent: number; catatan?: string }) => {
    try {
      const { error } = await supabase.from("absensi_v2").upsert({
        mesin: config.key,
        tanggal: data.tanggal,
        shift: data.shift,
        hadir: data.mp_hadir,
        absen: data.mp_absent,
        total_orang: data.mp_hadir + data.mp_absent,
      });
      if (error) throw error;
      alert("Data Kehadiran (MP) disimpan!");
      loadData();
    } catch (err: any) {
      alert("Gagal menyimpan absensi: " + err.message);
    }
  };

  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  return (
    <HeaderNav>
      {/* Header Halaman Mesin */}
      <div className="page-header mb-6">
        <div>
          <span className="eyebrow">MONITORING MESIN</span>
          <h1 className="page-title text-2xl font-bold font-display">{config.label}</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1 text-sm font-mono"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
          <select
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1 text-sm font-mono"
            value={shift}
            onChange={(e) => setShift(Number(e.target.value))}
          >
            <option value={1}>Shift 1</option>
            <option value={2}>Shift 2</option>
          </select>
        </div>
      </div>

      {/* Control Buttons Bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={() => setIsDowntimeOpen(true)}
        >
          <span>⏱</span> Catat Downtime
        </button>
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={() => setIsNonProduksiOpen(true)}
        >
          <span>📋</span> Jam Non-Produksi
        </button>
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={() => setIsAttendanceOpen(true)}
        >
          <span>👥</span> Attendance MP ({attendance ? `${attendance.mp_hadir || 0} Hadir` : "Belum diisi"})
        </button>
      </div>

      {/* Live Timer / Batch Status Panel */}
      <div className="panel mb-6">
        <div className="timer-row flex justify-between items-center flex-wrap gap-4">
          <div className="timer-badge">
            <span className={`timer-dot ${isLive ? "timer-dot-live" : ""}`} />
            <span>Status Machine: <b>{isLive ? "RUNNING BATCH" : "READY / IDLE"}</b></span>
            {startTime && (
              <span className="text-xs text-[var(--muted)] font-mono">
                Mulai: {new Date(startTime).toLocaleTimeString("id-ID")}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {!isLive ? (
              <button className="btn-primary" onClick={handleStartBatch}>
                ▶️ Mulai Produksi Batch Baru
              </button>
            ) : (
              <button className="btn-danger" onClick={() => setIsLive(false)}>
                ⏹ Batalkan Timer
              </button>
            )}
          </div>
        </div>

        {/* Production Input Form */}
        <form onSubmit={handleSaveProduction} className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="form-grid">
            <div className="field">
              <label>Part Name / Kode Part</label>
              <select
                value={selectedPart}
                onChange={(e) => {
                  setSelectedPart(e.target.value);
                  const p = masterParts.find((mp) => mp.nama_part === e.target.value || mp.kode_part === e.target.value);
                  if (p?.next_process) setNextProcess(p.next_process);
                }}
                required
              >
                <option value="">-- Pilih Part --</option>
                {masterParts.map((p) => (
                  <option key={p.kode_part} value={p.nama_part || p.kode_part}>
                    {p.kode_part} - {p.nama_part || ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Hasil OK (pcs)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={okQty}
                onChange={(e) => setOkQty(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>

            <div className="field">
              <label>Hasil NG (pcs)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={ngQty}
                onChange={(e) => setNgQty(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className="field">
              <label>Dandori / Setup (menit)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={dandoriMinutes}
                onChange={(e) => setDandoriMinutes(Number(e.target.value))}
              />
            </div>

            <div className="field">
              <label>Next Process</label>
              <input
                type="text"
                placeholder="misal: Welding / Painting"
                value={nextProcess}
                onChange={(e) => setNextProcess(e.target.value)}
              />
            </div>

            {/* Config-based extra fields (e.g., Top Coil / Berat Coil for Blanking) */}
            {config.extraFields.map((ef) => (
              <div key={ef.key} className="field">
                <label>{ef.label}</label>
                <input
                  type={ef.type}
                  value={extraValues[ef.key] || ""}
                  onChange={(e) => setExtraValues({ ...extraValues, [ef.key]: e.target.value })}
                />
              </div>
            ))}
          </div>

          {/* Routing option for Tandem */}
          {config.routingMax > 0 && (
            <div className="mt-4">
              <label className="text-xs text-[var(--muted)] font-mono uppercase block mb-2">
                Pilih Process Routing (Line Tandem)
              </label>
              <div className="chip-row">
                {Array.from({ length: config.routingMax }).map((_, idx) => {
                  const num = idx + 1;
                  return (
                    <button
                      type="button"
                      key={num}
                      className={`chip chip-num ${routingNo === num ? "chip-active" : ""}`}
                      onClick={() => setRoutingNo(num)}
                    >
                      P{num}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-actions mt-6">
            <button type="submit" className="btn-primary py-2.5 px-6">
              💾 Simpan Data Produksi
            </button>
          </div>
        </form>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border)] mb-6 gap-2">
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            activeTab === "produksi"
              ? "border-[var(--amber)] text-[var(--amber)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
          onClick={() => setActiveTab("produksi")}
        >
          Data Produksi ({produksiList.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            activeTab === "downtime"
              ? "border-[var(--amber)] text-[var(--amber)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
          onClick={() => setActiveTab("downtime")}
        >
          Log Downtime ({downtimeList.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            activeTab === "non_produksi"
              ? "border-[var(--amber)] text-[var(--amber)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
          onClick={() => setActiveTab("non_produksi")}
        >
          Jam Non-Produksi ({nonProduksiList.length})
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <p className="empty-state">Memuat data mesin...</p>
      ) : (
        <>
          {activeTab === "produksi" && (
            <div className="panel">
              <h3 className="panel-title font-bold text-base mb-4">Catatan Produksi Shift Ini</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Part Name</th>
                      <th>OK Qty</th>
                      <th>NG Qty</th>
                      <th>Dandori</th>
                      <th>Next Process</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produksiList.map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td className="mono">
                          {p.waktu_mulai ? new Date(p.waktu_mulai).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td><b>{p.part_name}</b></td>
                        <td className="mono font-bold text-[var(--green)]">{fmtNum(p.ok_qty)}</td>
                        <td className="mono text-[var(--red)]">{fmtNum(p.ng_qty)}</td>
                        <td className="mono">{fmtNum(p.dandori_menit)} mnt</td>
                        <td>{p.next_process || "-"}</td>
                      </tr>
                    ))}
                    {produksiList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-[var(--muted)] py-6">
                          Belum ada data produksi pada tanggal &amp; shift ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "downtime" && (
            <div className="panel">
              <h3 className="panel-title font-bold text-base mb-4">Log Downtime / Stop Line</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kategori</th>
                      <th>Station</th>
                      <th>Deskripsi Problem</th>
                      <th>Durasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeList.map((d, idx) => (
                      <tr key={d.id || idx}>
                        <td><span className="badge">{d.kategori}</span></td>
                        <td>{d.station || "-"}</td>
                        <td>{d.deskripsi}</td>
                        <td className="mono font-bold text-[var(--amber)]">{fmtNum(d.durasi_menit)} mnt</td>
                      </tr>
                    ))}
                    {downtimeList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-[var(--muted)] py-6">
                          Tidak ada catatan downtime pada tanggal &amp; shift ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "non_produksi" && (
            <div className="panel">
              <h3 className="panel-title font-bold text-base mb-4">Log Kegiatan Non-Produksi</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kegiatan</th>
                      <th>Durasi</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonProduksiList.map((np, idx) => (
                      <tr key={np.id || idx}>
                        <td><b>{np.kegiatan}</b></td>
                        <td className="mono">{fmtNum(np.durasi_menit)} mnt</td>
                        <td>{np.keterangan || "-"}</td>
                      </tr>
                    ))}
                    {nonProduksiList.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-[var(--muted)] py-6">
                          Belum ada catatan kegiatan non-produksi.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Render Modals */}
      <DowntimeModal
        isOpen={isDowntimeOpen}
        onClose={() => setIsDowntimeOpen(false)}
        onSave={handleSaveDowntime}
        kategoriOptions={config.kategoriOptions}
        stations={
          config.stationConfig.mode === "fixed"
            ? config.stationConfig.stations
            : config.stationConfig.mode === "variant"
            ? config.stationConfig.variants?.lama
            : []
        }
      />

      <AttendanceModal
        isOpen={isAttendanceOpen}
        onClose={() => setIsAttendanceOpen(false)}
        onSave={handleSaveAttendance}
      />

      <NonProduksiModal
        isOpen={isNonProduksiOpen}
        onClose={() => setIsNonProduksiOpen(false)}
        onSave={handleSaveNonProduksi}
      />
    </HeaderNav>
  );
}
