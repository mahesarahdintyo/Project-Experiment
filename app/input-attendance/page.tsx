"use client";

import React, { useState, useEffect } from "react";
import HeaderNav from "@/components/HeaderNav";
import { supabase } from "@/lib/supabaseClient";
import { Profile, AttendanceRecord } from "@/types/database";

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default function InputAttendancePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<AttendanceRecord>({
    tanggal: today,
    shift: 1,
    total_orang: 0,
    hadir: 0,
    cuti: 0,
    absen: 0,
    overtime_jam: 0,
  });

  const flash = (m: string, isErr = false) => {
    setMsg(m); setMsgError(isErr);
    setTimeout(() => setMsg(""), 4000);
  };

  const isLeaderOrAdmin = profile && ["admin", "leader"].includes(profile.role || "");

  const fetchRows = async () => {
    const res = await supabase.from("attendance_log").select("*").order("tanggal", { ascending: false }).limit(60);
    if (res.data) setRows(res.data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data) setProfile(data as Profile);
      fetchRows();
    };
    init();
  }, []);

  const save = async () => {
    try {
      const payload = {
        tanggal: form.tanggal,
        shift: Number(form.shift),
        total_orang: Number(form.total_orang),
        hadir: Number(form.hadir),
        cuti: Number(form.cuti),
        absen: Number(form.absen),
        overtime_jam: Number(form.overtime_jam),
      };

      let res;
      if (editId) {
        res = await supabase.from("attendance_log").update(payload).eq("id", editId);
      } else {
        res = await supabase.from("attendance_log").insert(payload);
      }
      if (res.error) throw res.error;

      flash(editId ? "Data absensi diperbarui!" : "Absensi berhasil disimpan!");
      setEditId(null);
      setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      fetchRows();
    } catch (err: any) {
      flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
    }
  };

  const edit = (r: AttendanceRecord) => {
    setEditId(r.id || null);
    setForm({ ...r });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <HeaderNav activeTitle="Input Attendance">
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Attendance Harian
        </h1>
      </div>

      {profile && !isLeaderOrAdmin && (
        <div className="error-msg">Halaman ini khusus admin/leader.</div>
      )}

      {msg && <div className={msgError ? "error-msg" : "success-msg"}>{msg}</div>}

      {isLeaderOrAdmin && (
        <div>
          <div className="panel">
            <p className="panel-title">
              {editId ? "Edit Absensi" : "Form Absensi"}
              {editId && (
                <button
                  className="btn-ghost btn-sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => { setEditId(null); setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 }); }}
                >
                  ✕ Batal Edit
                </button>
              )}
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Tanggal</label>
                <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="field">
                <label>Shift</label>
                <select value={form.shift} onChange={(e) => setForm({ ...form, shift: Number(e.target.value) })}>
                  <option value={1}>Shift 1</option>
                  <option value={2}>Shift 2</option>
                </select>
              </div>
              <div className="field">
                <label>Total Orang</label>
                <input type="number" value={form.total_orang} onChange={(e) => setForm({ ...form, total_orang: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Hadir</label>
                <input type="number" value={form.hadir} onChange={(e) => setForm({ ...form, hadir: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Cuti</label>
                <input type="number" value={form.cuti} onChange={(e) => setForm({ ...form, cuti: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Absen</label>
                <input type="number" value={form.absen} onChange={(e) => setForm({ ...form, absen: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Overtime (jam)</label>
                <input type="number" step="0.5" value={form.overtime_jam} onChange={(e) => setForm({ ...form, overtime_jam: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={save}>
                {editId ? "Update Absensi" : "Simpan Absensi"}
              </button>
            </div>
          </div>

          <div className="panel">
            <p className="panel-title">
              Riwayat Absensi{" "}
              <span className="count">{rows.length} baris</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Shift</th>
                    <th>Total</th>
                    <th>Hadir</th>
                    <th>Cuti</th>
                    <th>Absen</th>
                    <th>OT (jam)</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.tanggal}</td>
                      <td>Shift {r.shift}</td>
                      <td className="mono">{fmtNum(r.total_orang)}</td>
                      <td className="mono">{fmtNum(r.hadir)}</td>
                      <td className="mono">{fmtNum(r.cuti)}</td>
                      <td className="mono">{fmtNum(r.absen)}</td>
                      <td className="mono">{fmtNum(r.overtime_jam)}</td>
                      <td>
                        <button className="btn-secondary btn-sm" onClick={() => edit(r)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty-state">Belum ada data absensi.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </HeaderNav>
  );
}
