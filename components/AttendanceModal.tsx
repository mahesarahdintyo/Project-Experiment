"use client";

import React, { useState } from "react";

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { tanggal: string; shift: number; mp_hadir: number; mp_absent: number; catatan?: string }) => void;
}

export default function AttendanceModal({
  isOpen,
  onClose,
  onSave,
}: AttendanceModalProps) {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [shift, setShift] = useState(1);
  const [mpHadir, setMpHadir] = useState<number | "">(8);
  const [mpAbsent, setMpAbsent] = useState<number | "">(0);
  const [catatan, setCatatan] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      tanggal,
      shift: Number(shift),
      mp_hadir: Number(mpHadir) || 0,
      mp_absent: Number(mpAbsent) || 0,
      catatan,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="panel w-full max-w-md bg-[var(--panel)] border border-[var(--border)] rounded-lg p-6 shadow-xl text-[var(--text)]">
        <h3 className="panel-title text-lg font-bold mb-4 flex justify-between items-center">
          <span>Input Manpower Attendance</span>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>Tanggal</label>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
            </div>
            <div className="field">
              <label>Shift</label>
              <select value={shift} onChange={(e) => setShift(Number(e.target.value))}>
                <option value={1}>Shift 1</option>
                <option value={2}>Shift 2</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>MP Hadir</label>
              <input type="number" min="0" value={mpHadir} onChange={(e) => setMpHadir(e.target.value === "" ? "" : Number(e.target.value))} required />
            </div>
            <div className="field">
              <label>MP Absent / Izin</label>
              <input type="number" min="0" value={mpAbsent} onChange={(e) => setMpAbsent(e.target.value === "" ? "" : Number(e.target.value))} required />
            </div>
          </div>

          <div className="field">
            <label>Catatan Absensi</label>
            <input type="text" placeholder="misal: 1 sakit, 1 ijin" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </div>

          <div className="form-actions pt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary">Simpan Attendance</button>
          </div>
        </form>
      </div>
    </div>
  );
}
