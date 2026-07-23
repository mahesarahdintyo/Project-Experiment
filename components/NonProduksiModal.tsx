"use client";

import React, { useState } from "react";

interface NonProduksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { kegiatan: string; durasi_menit: number; keterangan?: string }) => void;
}

const KEGIATAN_OPTIONS = [
  "Meeting / Morning Briefing",
  "Watari / Transfer Material",
  "5S & Clean Up",
  "Pelatihan / Training",
  "Perawatan Periodik / Maintenance",
  "Lain-lain",
];

export default function NonProduksiModal({
  isOpen,
  onClose,
  onSave,
}: NonProduksiModalProps) {
  const [kegiatan, setKegiatan] = useState(KEGIATAN_OPTIONS[0]);
  const [durasiMenit, setDurasiMenit] = useState<number | "">("");
  const [keterangan, setKeterangan] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!durasiMenit || Number(durasiMenit) <= 0) return;
    onSave({
      kegiatan,
      durasi_menit: Number(durasiMenit),
      keterangan,
    });
    setDurasiMenit("");
    setKeterangan("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="panel w-full max-w-md bg-[var(--panel)] border border-[var(--border)] rounded-lg p-6 shadow-xl text-[var(--text)]">
        <h3 className="panel-title text-lg font-bold mb-4 flex justify-between items-center">
          <span>Catat Jam Non-Produksi</span>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>Jenis Kegiatan</label>
            <select value={kegiatan} onChange={(e) => setKegiatan(e.target.value)}>
              {KEGIATAN_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Durasi (Menit)</label>
            <input
              type="number"
              min="1"
              placeholder="misal: 30"
              value={durasiMenit}
              onChange={(e) => setDurasiMenit(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>

          <div className="field">
            <label>Keterangan Tambahan</label>
            <input
              type="text"
              placeholder="detail kegiatan..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>

          <div className="form-actions pt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary">Simpan Jam Non-Produksi</button>
          </div>
        </form>
      </div>
    </div>
  );
}
