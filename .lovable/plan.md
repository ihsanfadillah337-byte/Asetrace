
# Interactive Canvas Floor Map (Frontend-Only)

## Konsep Utama
Semua perubahan posisi dan ukuran room hanya disimpan di **localStorage** browser. Database `rooms` table TIDAK diubah sama sekali. Gateway tetap aman karena koneksinya via `room_id`, bukan koordinat.

## Kenapa Gateway Aman?
Gateway terhubung ke room lewat `room_id` (UUID reference), bukan `position_x`/`position_y`. Koordinat SVG hanya dipakai untuk menggambar kotak di layar -- mengubahnya tidak mempengaruhi koneksi BLE sama sekali.

## Implementasi

### 1. Custom Layout Hook (File Baru)
Buat `src/hooks/useFloorMapLayout.ts`:
- Menyimpan override posisi (x, y) dan ukuran (width, height) per room di localStorage
- Key: `floormap-layout-{roomId}`
- Fungsi: `getLayout(roomId)`, `updateLayout(roomId, {x, y, w, h})`, `resetLayout(floor)`
- Jika tidak ada override di localStorage, fallback ke `position_x`/`position_y` dari database dan default size 90x60

### 2. Edit Mode Toggle di AssetMap
Tambahkan tombol "Edit Layout" di header floor map (samping zoom controls):
- **View Mode** (default): Klik room = buka popover detail aset (seperti sekarang)
- **Edit Mode**: Klik room = drag untuk pindah posisi, drag handle pojok = resize

### 3. Drag & Drop (Reposisi Room)
Di Edit Mode:
- `onMouseDown` pada room rect -> mulai drag, simpan offset
- `onMouseMove` pada SVG container -> update posisi room secara visual (React state)
- `onMouseUp` -> simpan posisi baru ke localStorage

### 4. Resize Handle
Di Edit Mode, tampilkan handle kecil (8x8px) di pojok kanan-bawah setiap room:
- Drag handle -> ubah width dan height room
- Minimum size: 60x40px
- Simpan ke localStorage saat mouse up

### 5. Visual Feedback Edit Mode
- Border dashed pada semua room saat edit mode
- Cursor `grab` / `grabbing` saat drag
- Cursor `nwse-resize` pada resize handle
- Badge "Editing" di header
- Instruksi singkat: "Drag to move, drag corner to resize"

### 6. Reset Layout
Tombol "Reset Layout" untuk menghapus semua override localStorage dan kembali ke posisi database default.

### 7. Responsive SVG ViewBox
ViewBox SVG akan di-recalculate otomatis berdasarkan posisi + ukuran room yang sudah di-override, supaya semua room tetap visible meskipun dipindah ke area yang lebih besar.

## File yang Diubah
1. **`src/hooks/useFloorMapLayout.ts`** (BARU) - Hook localStorage untuk layout override
2. **`src/components/dashboard/AssetMap.tsx`** (EDIT) - Tambah edit mode, drag, resize, reset

## Yang TIDAK Berubah
- Database `rooms` table -- tidak ada migration
- Gateway connections -- tetap via `room_id`
- Semua logic tracking, ghost asset, popover detail
- Realtime subscriptions
- Hook `useRooms`, `useBLEGateways`, `useAssetLocations`
