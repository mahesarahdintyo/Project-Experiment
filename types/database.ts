export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  role?: "admin" | "leader" | "operator" | string;
}

export interface ExtraField {
  key: string;
  label: string;
  type: "text" | "number";
}

export interface StationConfig {
  mode: "none" | "fixed" | "variant";
  stations?: string[];
  variants?: Record<string, string[]>;
}

export interface MachineConfig {
  slug: string;
  key: string;
  label: string;
  extraFields: ExtraField[];
  routingMax: number;
  kategoriOptions: string[];
  stationConfig: StationConfig;
}

export interface MasterPart {
  id?: string;
  kode_part: string;
  nama_part?: string;
  mesin: string;
  ct_detik?: number;
  mp_std?: number;
  next_process?: string;
  harga_rp?: number;
}

export interface ProductionRecord {
  id?: string;
  tanggal: string;
  shift: number;
  mesin: string;
  part_name: string;
  waktu_mulai: string;
  waktu_selesai?: string;
  total_menit?: number;
  dandori_menit?: number;
  break_menit?: number;
  downtime_menit?: number;
  waktu_kerja_nett?: number;
  ok_qty: number;
  ng_qty: number;
  target_qty?: number;
  pencapaian_persen?: number;
  ratio_stroke_persen?: number;
  routing_no?: number;
  top_coil?: string;
  berat_coil?: number;
  next_process?: string;
  created_at?: string;
}

export interface DowntimeRecord {
  id?: string;
  produksi_id?: string;
  mesin: string;
  tanggal: string;
  shift: number;
  kategori: string;
  deskripsi: string;
  durasi_menit: number;
  station?: string;
  created_at?: string;
}

export interface NonProduksiRecord {
  id?: string;
  tanggal: string;
  shift: number;
  mesin: string;
  kegiatan: string;
  durasi_menit: number;
  keterangan?: string;
  created_at?: string;
}

export interface AttendanceRecord {
  id?: string;
  tanggal: string;
  shift?: number;
  total_orang: number;
  hadir: number;
  cuti?: number;
  absen: number;
  overtime_jam?: number;
  catatan?: string;
  created_at?: string;
}

export interface SafetyRecord {
  id?: string;
  tanggal: string;
  kategori: "ACCIDENT" | "NEAR_MISS" | "OTHER" | string;
  keterangan?: string;
  created_at?: string;
}

export interface ScrapRecord {
  id?: string;
  tahun: number;
  bulan: number;
  scrap_value_kidr: number;
  total_value_kidr?: number;
  target_rasio?: number;
  created_at?: string;
}

export interface SQCDMPRecord {
  id?: string;
  tanggal: string;
  shift: number;
  mesin: string;
  safety?: "OK" | "NG";
  quality?: "OK" | "NG";
  cost?: "OK" | "NG";
  delivery?: "OK" | "NG";
  moral?: "OK" | "NG";
  productivity?: "OK" | "NG";
  catatan?: string;
  created_at?: string;
}
