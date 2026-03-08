# Arsitektur Sistem Asetrace - Digital Twin Asset Tracking

Dokumen ini berisi diagram arsitektur sistem dan daftar skenario demo untuk Bab 3 dan Bab 4 skripsi.

## 1. DIAGRAM ARSITEKTUR SISTEM

### 1.1 Arsitektur High-Level (System Overview)

```mermaid
graph TB
    subgraph Physical["🔧 Physical Layer (IoT)"]
        BLE[("BLE Beacon Tag<br/>ESP32-C3")]
        GW[("BLE Gateway<br/>ESP32-WROOM")]
        ASSET["📦 Physical Asset"]
    end
    
    subgraph Backend["☁️ Backend Layer (Lovable Cloud)"]
        EF["Edge Function<br/>ble-tracking"]
        DB[("Supabase<br/>PostgreSQL")]
        RT["Realtime<br/>WebSocket"]
        AUTH["Auth<br/>Service"]
    end
    
    subgraph Frontend["💻 Frontend Layer (React)"]
        DASH["Admin Dashboard"]
        MAP["Floor Map<br/>Visualization"]
        INV["Asset Inventory"]
        NOTIF["Notification<br/>System"]
    end
    
    subgraph Users["👥 User Layer"]
        ADMIN["Admin/Operator"]
        USER["Regular User"]
    end
    
    %% Physical connections
    ASSET -.->|attached to| BLE
    BLE -->|BLE Advertisement| GW
    GW -->|HTTP POST<br/>WiFi| EF
    
    %% Backend connections
    EF -->|INSERT/UPDATE| DB
    DB -->|postgres_changes| RT
    AUTH -->|JWT Token| DB
    
    %% Frontend connections
    RT -->|Realtime Data| DASH
    RT -->|Realtime Data| MAP
    DB -->|REST API| INV
    DB -->|REST API| NOTIF
    
    %% User connections
    ADMIN -->|Manage| DASH
    USER -->|View/Request| INV
```

### 1.2 Data Flow: ESP32 to Frontend (End-to-End)

```mermaid
sequenceDiagram
    participant BLE as BLE Tag (ESP32-C3)
    participant GW as Gateway (ESP32-WROOM)
    participant EF as Edge Function
    participant DB as Database
    participant RT as Realtime Channel
    participant UI as React Frontend
    
    Note over BLE,UI: Flow Deteksi Aset Real-time
    
    BLE->>GW: BLE Advertisement (MAC, RSSI)
    Note right of BLE: Broadcast setiap 100ms
    
    GW->>GW: Scan & Buffer (5 detik)
    GW->>EF: HTTP POST /ble-tracking
    Note right of GW: Payload: receiver_id, scans[]
    
    EF->>EF: Validate & Process
    EF->>DB: UPSERT asset_locations
    EF->>DB: INSERT asset_movement_history
    EF->>DB: UPDATE ble_gateways (heartbeat)
    EF->>DB: INSERT ble_rssi_buffer
    EF-->>GW: Response 200 OK
    
    DB->>RT: Trigger postgres_changes
    RT->>UI: WebSocket Push
    
    UI->>UI: Update Floor Map
    UI->>UI: Update Metrics
    UI->>UI: Show LIVE Badge
    
    Note over BLE,UI: Total Latency: < 2 detik
```

### 1.3 Arsitektur Database (ERD Simplified)

```mermaid
erDiagram
    assets ||--o{ asset_locations : "tracked by"
    assets ||--o{ asset_movement_history : "has history"
    assets ||--o{ borrow_requests : "borrowed via"
    assets ||--o{ maintenance_history : "maintained"
    assets ||--o{ asset_usage_logs : "usage"
    
    rooms ||--o{ assets : "contains"
    rooms ||--o{ ble_gateways : "has gateway"
    rooms ||--o{ asset_locations : "location"
    
    students ||--o{ borrow_requests : "requests"
    profiles ||--o{ notifications : "receives"
    user_roles ||--|| profiles : "has role"
    
    assets {
        uuid id PK
        string name
        enum status "active|borrowed|maintenance|lost|damaged|idle|untracked"
        string ble_tag_mac "MAC address of BLE tag"
        string room_id FK
        string floor
    }
    
    asset_locations {
        uuid id PK
        uuid asset_id FK
        uuid room_id FK
        string receiver_id "Gateway yang mendeteksi"
        string tag_mac "MAC BLE Tag"
        int rssi "Signal strength"
        string confidence "high|medium|low"
        timestamp updated_at "Terakhir terdeteksi"
    }
    
    asset_movement_history {
        uuid id PK
        uuid asset_id FK
        uuid from_room_id FK
        uuid to_room_id FK
        string from_room_name
        string to_room_name
        int rssi
        timestamp moved_at
    }
    
    ble_gateways {
        uuid id PK
        string receiver_id UK "ESP32_R101"
        uuid room_id FK
        string status "online|stale|offline"
        int scan_count
        timestamp last_seen "Heartbeat"
    }
    
    rooms {
        uuid id PK
        string room_code "R101"
        string room_name "Laboratorium IoT"
        string floor "Lantai 1"
        int position_x "Posisi di Floor Map"
        int position_y "Posisi di Floor Map"
    }
    
    borrow_requests {
        uuid id PK
        uuid asset_id FK
        uuid student_id FK
        string status "Pending|Approved|Rejected|Returned"
        date tanggal_pinjam
        date tanggal_kembali
    }
    
    notifications {
        uuid id PK
        uuid user_id FK
        string type
        string title
        string message
        boolean read_status
    }
```

### 1.4 State Machine: Asset Status

```mermaid
stateDiagram-v2
    [*] --> Active: Asset Registered
    
    Active --> Borrowed: Borrow Approved
    Borrowed --> Active: Returned
    
    Active --> Maintenance: Scheduled Maintenance
    Maintenance --> Active: Maintenance Completed
    
    Active --> Damaged: Damage Reported
    Damaged --> Maintenance: Repair Started
    Damaged --> Lost: Not Recoverable
    
    Active --> Lost: Asset Missing
    Lost --> Active: Asset Found
    
    Active --> Idle: Unused > 30 days
    Idle --> Active: Asset Used
    
    note right of Active
        Aset tersedia untuk
        dipinjam atau digunakan
    end note
    
    note right of Borrowed
        Status dari Sistem Transaksional
        (Admin/Operator approval)
    end note
    
    note left of Lost
        Dapat dideteksi sebagai
        "Ghost Asset" oleh IoT
    end note
```

### 1.5 Konsep Digital Twin: Two Sources of Truth

```mermaid
graph LR
    subgraph Transactional["📋 Transactional Truth (Admin)"]
        STATUS["Asset Status<br/>Active | Borrowed | Maintenance"]
        MANUAL["Manual Location<br/>Room Assignment"]
    end
    
    subgraph Spatial["📡 Spatial Truth (IoT)"]
        DETECT["BLE Detection<br/>RSSI Signal"]
        AUTO["Auto Location<br/>Gateway Room"]
    end
    
    subgraph Analysis["🔍 Anomaly Detection"]
        MATCH{Match?}
        NORMAL["✅ Normal<br/>Consistent State"]
        GHOST["⚠️ Ghost Asset<br/>Location Mismatch"]
        LOST["🔴 Signal Lost<br/>Possible Missing"]
    end
    
    STATUS --> MATCH
    DETECT --> MATCH
    
    MATCH -->|Yes| NORMAL
    MATCH -->|No - Wrong Room| GHOST
    MATCH -->|No - No Signal| LOST
    
    GHOST --> NOTIF["🔔 Alert Admin"]
    LOST --> NOTIF
```

### 1.6 Blind Spot Architecture (CRITICAL CONCEPT)

```mermaid
graph TB
    subgraph Building["🏢 Building Layout"]
        subgraph Floor1["Lantai 1"]
            R101["R101 - Lab IoT<br/>🟢 Gateway Active"]
            R102["R102 - Lab Komputer<br/>🟢 Gateway Active"]
            ADMIN["Admin Room<br/>🔴 NO GATEWAY"]
        end
        
        subgraph Floor2["Lantai 2"]
            R201["R201 - Ruang Dosen<br/>🟢 Gateway Active"]
            LOBBY["Lobby<br/>🟢 Gateway Active"]
        end
    end
    
    subgraph Logic["📐 Tracking Logic"]
        TRACK["Asset dengan BLE Tag"]
        
        TRACK --> |Terdeteksi di R101| LIVE["✅ LIVE Tracking<br/>Lokasi diketahui"]
        TRACK --> |Tidak terdeteksi| CHECK{"Cek Status?"}
        
        CHECK --> |Status = Available| MISSING["⚠️ Possibly Missing<br/>atau di Admin Room"]
        CHECK --> |Status = Borrowed| OK["✅ Expected<br/>Sedang dipinjam"]
    end
    
    style ADMIN fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style LIVE fill:#51cf66,stroke:#2b8a3e
    style MISSING fill:#ffd43b,stroke:#e67700
```

---

## 2. DAFTAR SKENARIO DEMO SISTEM

### 2.1 Pre-Demo Checklist

| No | Item | Status | Notes |
|----|------|--------|-------|
| 1 | ESP32 Gateway powered on | ⬜ | Cek LED dan Serial Monitor |
| 2 | ESP32 connected to WiFi | ⬜ | Verifikasi "WiFi Connected!" |
| 3 | BLE Tag batteries checked | ⬜ | Ganti jika lemah |
| 4 | Supabase project online | ⬜ | Cek di Lovable Cloud |
| 5 | Admin account ready | ⬜ | Username dan password siap |
| 6 | Browser clear cache | ⬜ | Ctrl+Shift+R |

### 2.2 Skenario Demo End-to-End

#### **SKENARIO A: Realtime Asset Tracking**
Tujuan: Membuktikan sistem dapat melacak aset secara real-time

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| A1 | Login sebagai Admin | Dashboard muncul dengan metrics | ⬜ |
| A2 | Buka halaman Dashboard | Floor Map terlihat dengan gateway markers | ⬜ |
| A3 | Pastikan gateway menunjukkan status "ONLINE" | Badge hijau "Online" pada gateway | ⬜ |
| A4 | Letakkan aset (dengan BLE tag) di ruangan dengan gateway | Dalam 5-10 detik, aset muncul di Floor Map | ⬜ |
| A5 | Verifikasi badge "LIVE" muncul | Angka "X LIVE" di header Floor Map | ⬜ |
| A6 | Klik pada ruangan di Floor Map | Popup menunjukkan daftar aset di ruangan | ⬜ |
| A7 | Pindahkan aset ke ruangan lain (dengan gateway berbeda) | Lokasi aset berubah dalam 10-15 detik | ⬜ |

#### **SKENARIO B: Movement History Tracking**
Tujuan: Membuktikan sistem mencatat riwayat perpindahan aset

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| B1 | Buka Asset Detail page (klik aset dari inventory) | Halaman detail terbuka | ⬜ |
| B2 | Scroll ke tab "Movement" | Timeline perpindahan terlihat | ⬜ |
| B3 | Verifikasi perpindahan dari Skenario A tercatat | Entry dengan "From Room" dan "To Room" | ⬜ |
| B4 | Cek durasi "Dwell Time" | Waktu tinggal di ruangan sebelumnya | ⬜ |
| B5 | Cek RSSI chart | Grafik signal strength terlihat | ⬜ |

#### **SKENARIO C: Borrow Management Flow**
Tujuan: Membuktikan sistem peminjaman terintegrasi dengan tracking

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| C1 | Login sebagai User biasa | User Dashboard muncul | ⬜ |
| C2 | Buat permintaan peminjaman untuk aset | Form tersubmit, status "Pending" | ⬜ |
| C3 | Login kembali sebagai Admin | Notifikasi borrow request muncul | ⬜ |
| C4 | Approve permintaan | Status berubah ke "Approved", aset jadi "Borrowed" | ⬜ |
| C5 | Verifikasi notifikasi dikirim ke User | User menerima notifikasi approval | ⬜ |
| C6 | Proses pengembalian aset | Status kembali ke "Active" | ⬜ |

#### **SKENARIO D: Gateway Heartbeat & Status**
Tujuan: Membuktikan sistem mendeteksi gateway online/offline

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| D1 | Buka halaman BLE Configuration | Daftar gateway terlihat | ⬜ |
| D2 | Pastikan gateway menunjukkan "ONLINE" | Badge hijau, timestamp "just now" | ⬜ |
| D3 | Matikan ESP32 Gateway (cabut power) | Status berubah ke "STALE" dalam 15-45 detik | ⬜ |
| D4 | Tunggu 1 menit | Status berubah ke "OFFLINE" | ⬜ |
| D5 | Nyalakan kembali ESP32 | Status kembali ke "ONLINE" dalam 10-15 detik | ⬜ |

#### **SKENARIO E: AI Report Generation**
Tujuan: Membuktikan sistem dapat menghasilkan insight berbasis AI

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| E1 | Buka halaman Reports | Tombol "Generate AI Report" terlihat | ⬜ |
| E2 | Klik tombol Generate Report | Loading indicator muncul | ⬜ |
| E3 | Tunggu proses selesai | Report markdown muncul dengan insights | ⬜ |
| E4 | Verifikasi konten report mencakup: | | |
| | - Asset distribution summary | ⬜ | |
| | - Movement patterns | ⬜ | |
| | - Anomaly detection (ghost assets) | ⬜ | |
| | - Recommendations | ⬜ | |
| E5 | Export report ke PDF | File terdownload | ⬜ |

#### **SKENARIO F: Notification System**
Tujuan: Membuktikan sistem notifikasi real-time berfungsi

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| F1 | Buka halaman Notifications | Daftar notifikasi terlihat | ⬜ |
| F2 | Create borrow request dari user lain | Notifikasi baru muncul untuk admin | ⬜ |
| F3 | Klik notifikasi | Detail notifikasi terbuka | ⬜ |
| F4 | Mark as read | Status berubah (tidak bold) | ⬜ |
| F5 | Cek notification bell di header | Counter badge terupdate | ⬜ |

#### **SKENARIO G: Ghost Asset Detection**
Tujuan: Membuktikan sistem dapat mendeteksi anomali lokasi

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| G1 | Pastikan aset memiliki status "Active" (Available) | Status terlihat di inventory | ⬜ |
| G2 | Pastikan aset ter-assign ke Room A | Location: Room A di detail | ⬜ |
| G3 | Pindahkan aset (fisik) ke Room B | BLE mendeteksi di Room B | ⬜ |
| G4 | Generate AI Report | Report menunjukkan "Ghost Asset" atau "Location Mismatch" | ⬜ |
| G5 | Alternatif: Cek icon warning di Floor Map | Icon segitiga kuning muncul | ⬜ |

### 2.3 Post-Demo Verification

| Verification | Pass | Notes |
|--------------|------|-------|
| All real-time updates worked without page refresh | ⬜ | |
| No console errors during demo | ⬜ | |
| Response time < 5 seconds for all actions | ⬜ | |
| Data consistency between pages | ⬜ | |
| Mobile responsive layout (if tested) | ⬜ | |

---

## 3. TIPS UNTUK PRESENTASI SKRIPSI

### 3.1 Highlight Fitur Utama

1. **Digital Twin Concept**: Tekankan dua sumber kebenaran (Transaksional vs Spatial)
2. **Realtime Tracking**: Demo live perpindahan aset
3. **Blind Spot Architecture**: Jelaskan mengapa Admin Room tidak ada gateway
4. **Ghost Asset Detection**: Sistem mendeteksi aset "nakal"
5. **AI Integration**: Report otomatis dengan insight

### 3.2 Antisipasi Pertanyaan Penguji

| Pertanyaan | Jawaban |
|------------|---------|
| "Bagaimana jika WiFi mati?" | Gateway akan offline, tapi data terakhir tetap tersimpan. Saat online kembali, akan sync otomatis. |
| "Akurasi RSSI?" | RSSI digunakan untuk proximity, bukan koordinat presisi. Threshold -85 dBm untuk "high confidence". |
| "Scalability?" | Arsitektur edge function stateless, dapat handle ribuan gateway dengan horizontal scaling. |
| "Security?" | RLS policies di setiap tabel, JWT authentication, role-based access control. |

### 3.3 Screenshot Checklist untuk Dokumentasi

- [ ] Dashboard dengan metrics
- [ ] Floor Map dengan gateway online
- [ ] Floor Map dengan asset LIVE
- [ ] Asset Detail dengan Movement Timeline
- [ ] Asset Detail dengan RSSI Chart
- [ ] Borrow Request flow (Pending → Approved → Returned)
- [ ] Notification list
- [ ] AI Report output
- [ ] BLE Configuration dengan gateway list
- [ ] Mobile responsive view

---

*Dokumen ini dibuat untuk keperluan Bab 3 (Metodologi) dan Bab 4 (Hasil & Pembahasan) skripsi.*
