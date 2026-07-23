"use client";

import React, { useState } from "react";

interface DowntimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { kategori: string; deskripsi: string; durasi_menit: number; station?: string }) => void;
  kategoriOptions: string[];
  stations?: string[];
}

export default function DowntimeModal({
  isOpen,
  onClose,
  onSave,
  kategoriOptions,
  stations = [],
}: DowntimeModalProps) {
  const [kategori, setKategori] = useState(kategoriOptions[0] || "MESIN");
  const [deskripsi, setDeskripsi] = useState("");
  const [durasiMenit, setDurasiMenit] = useState<number | "">("");
  const [station, setStation] = useState(stations[0] || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!durasiMenit || Number(durasiMenit) <= 0) return;
    onSave({
      kategori,
      deskripsi,
      durasi_menit: Number(durasiMenit),
      station: stations.length > 0 ? station : undefined,
    });
    setDeskripsi("");
    setDurasiMenit("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="panel w-full max-w-md bg-[var(--panel)] border border-[var(--border)] rounded-lg p-6 shadow-xl text-[var(--text)]">
        <h3 className="panel-title text-lg font-bold mb-4 flex justify-between items-center">
          <span>Catat Downtime / Stop Line</span>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>Kategori Downtime</label>
            <select value={kategori} onChange={(e) => setKategori(e.target.value)}>
              {kategoriOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {stations.length > 0 && (
            <div className="field">
              <label>Station / Process</label>
              <select value={station} onChange={(e) => setStation(e.target.value)}>
                {stations.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>Deskripsi / Gejala Problem</label>
            <textarea
              rows={3}
              placeholder="Jelaskan penyebab masalah / komponen rusak..."
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Durasi Downtime (Menit)</label>
            <input
              type="number"
              min="1"
              placeholder="misal: 15"
              value={durasiMenit}
              onChange={(e) => setDurasiMenit(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>

          <div className="form-actions pt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary">Simpan Downtime</button>
          </div>
        </form>
      </div>
    </div>
  );
}
