// Shared mock asset data used across Dashboard and Asset Inventory

export type AssetStatus = 'active' | 'maintenance' | 'lost' | 'damaged' | 'idle';
export type AssetCategory = 'laptop' | 'server' | 'furniture' | 'vehicle' | 'other';

export interface Asset {
  id: string;
  name: string;
  status: AssetStatus;
  condition: string;
  lastUser: string;
  category: AssetCategory;
  lastMaintenance: string;
  value: string;
  location: string; // Full location string for display
  floor: string;
  room: string;
  roomId: string;
  positionInRoom: { x: number; y: number };
  type: string;
  lastUpdated: string;
  imageUrl?: string;
  coordinates?: { lat: number; lng: number };
  activities?: Array<{
    date: string;
    action: string;
    user: string;
    location: string;
  }>;
  history?: Array<{
    date: string;
    type: string;
    icon: any;
    action: string;
    user: string;
    details: string;
    color: string;
  }>;
  maintenanceHistory?: Array<{
    date: string;
    type: string;
    technician: string;
    cost: string;
  }>;
  nextMaintenance?: string;
  usageStats?: {
    hoursToday: number;
    hoursWeek: number;
    hoursMonth: number;
  };
  alerts?: Array<{
    type: string;
    message: string;
    date: string;
  }>;
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  assets: Asset[];
}

export interface FloorData {
  floor: string;
  rooms: Room[];
  stats: {
    total: number;
    active: number;
    maintenance: number;
    lostDamaged: number;
  };
}

// Main asset data - synchronized across all pages
export const mockFloorData: FloorData[] = [
  {
    floor: '1',
    rooms: [
      {
        id: 'R101',
        name: 'Server Room',
        x: 10,
        y: 20,
        width: 25,
        height: 30,
        assets: [
          { 
            id: 'A001', 
            name: 'Server Rack #1', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'Admin', 
            category: 'server', 
            lastMaintenance: '2025-09-15', 
            value: '$12,500', 
            positionInRoom: { x: 30, y: 35 },
            location: 'Floor 1, Server Room',
            floor: '1',
            room: 'Server Room',
            roomId: 'R101',
            type: 'Server Equipment',
            lastUpdated: '2025-09-15 10:30'
          },
          { 
            id: 'A002', 
            name: 'Server Rack #2', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'IT Team', 
            category: 'server', 
            lastMaintenance: '2025-09-20', 
            value: '$11,800', 
            positionInRoom: { x: 65, y: 35 },
            location: 'Floor 1, Server Room',
            floor: '1',
            room: 'Server Room',
            roomId: 'R101',
            type: 'Server Equipment',
            lastUpdated: '2025-09-20 14:15'
          },
          { 
            id: 'A007', 
            name: 'Backup Server', 
            status: 'idle', 
            condition: 'Good', 
            lastUser: 'IT Team', 
            category: 'server', 
            lastMaintenance: '2025-08-10', 
            value: '$8,200', 
            positionInRoom: { x: 50, y: 70 },
            location: 'Floor 1, Server Room',
            floor: '1',
            room: 'Server Room',
            roomId: 'R101',
            type: 'Server Equipment',
            lastUpdated: '2025-08-10 09:00'
          },
        ]
      },
      {
        id: 'R102',
        name: 'IT Office',
        x: 45,
        y: 20,
        width: 30,
        height: 35,
        assets: [
          { 
            id: 'A003', 
            name: 'Laptop #47', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'John Doe', 
            category: 'laptop', 
            lastMaintenance: '2025-09-10', 
            value: '$1,450', 
            positionInRoom: { x: 25, y: 30 },
            location: 'Floor 1, IT Office',
            floor: '1',
            room: 'IT Office',
            roomId: 'R102',
            type: 'Computing Device',
            lastUpdated: '2025-09-10 11:20'
          },
          { 
            id: 'A004', 
            name: 'Printer #8', 
            status: 'maintenance', 
            condition: 'Fair', 
            lastUser: 'Jane Smith', 
            category: 'other', 
            lastMaintenance: '2025-09-28', 
            value: '$850', 
            positionInRoom: { x: 70, y: 60 },
            location: 'Floor 1, IT Office',
            floor: '1',
            room: 'IT Office',
            roomId: 'R102',
            type: 'Office Equipment',
            lastUpdated: '2025-09-28 15:45'
          },
          { 
            id: 'A008', 
            name: 'Laptop #48', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'Alice Brown', 
            category: 'laptop', 
            lastMaintenance: '2025-09-12', 
            value: '$1,550', 
            positionInRoom: { x: 55, y: 30 },
            location: 'Floor 1, IT Office',
            floor: '1',
            room: 'IT Office',
            roomId: 'R102',
            type: 'Computing Device',
            lastUpdated: '2025-09-12 08:30'
          },
          { 
            id: 'A009', 
            name: 'Desk Chair', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'Office', 
            category: 'furniture', 
            lastMaintenance: '2025-07-01', 
            value: '$320', 
            positionInRoom: { x: 35, y: 65 },
            location: 'Floor 1, IT Office',
            floor: '1',
            room: 'IT Office',
            roomId: 'R102',
            type: 'Furniture',
            lastUpdated: '2025-07-01 10:00'
          },
        ]
      },
      {
        id: 'R103',
        name: 'Storage',
        x: 10,
        y: 60,
        width: 35,
        height: 25,
        assets: [
          { 
            id: 'A005', 
            name: 'Generator #2', 
            status: 'damaged', 
            condition: 'Poor', 
            lastUser: 'Maintenance', 
            category: 'other', 
            lastMaintenance: '2025-08-01', 
            value: '$5,200', 
            positionInRoom: { x: 50, y: 50 },
            location: 'Floor 1, Storage',
            floor: '1',
            room: 'Storage',
            roomId: 'R103',
            type: 'Equipment',
            lastUpdated: '2025-08-01 13:20'
          },
        ]
      },
      {
        id: 'R104',
        name: 'Meeting Room A',
        x: 55,
        y: 65,
        width: 30,
        height: 20,
        assets: [
          { 
            id: 'A006', 
            name: 'Projector #3', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'Sales Team', 
            category: 'other', 
            lastMaintenance: '2025-09-18', 
            value: '$2,100', 
            positionInRoom: { x: 50, y: 40 },
            location: 'Floor 1, Meeting Room A',
            floor: '1',
            room: 'Meeting Room A',
            roomId: 'R104',
            type: 'Presentation Equipment',
            lastUpdated: '2025-09-18 16:00'
          },
        ]
      },
    ],
    stats: { total: 9, active: 6, maintenance: 1, lostDamaged: 1 }
  },
  {
    floor: '2',
    rooms: [
      {
        id: 'R201',
        name: 'Executive Office',
        x: 15,
        y: 15,
        width: 30,
        height: 30,
        assets: [
          { 
            id: 'A201', 
            name: 'Desktop PC #12', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'CEO', 
            category: 'laptop', 
            lastMaintenance: '2025-09-22', 
            value: '$2,850', 
            positionInRoom: { x: 40, y: 45 },
            location: 'Floor 2, Executive Office',
            floor: '2',
            room: 'Executive Office',
            roomId: 'R201',
            type: 'Computing Device',
            lastUpdated: '2025-09-22 09:15'
          },
          { 
            id: 'A202', 
            name: 'Tablet #15', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'CFO', 
            category: 'laptop', 
            lastMaintenance: '2025-09-15', 
            value: '$950', 
            positionInRoom: { x: 65, y: 50 },
            location: 'Floor 2, Executive Office',
            floor: '2',
            room: 'Executive Office',
            roomId: 'R201',
            type: 'Computing Device',
            lastUpdated: '2025-09-15 14:30'
          },
          { 
            id: 'A210', 
            name: 'Executive Desk', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'CEO', 
            category: 'furniture', 
            lastMaintenance: '2025-06-01', 
            value: '$3,200', 
            positionInRoom: { x: 50, y: 65 },
            location: 'Floor 2, Executive Office',
            floor: '2',
            room: 'Executive Office',
            roomId: 'R201',
            type: 'Furniture',
            lastUpdated: '2025-06-01 10:00'
          },
        ]
      },
      {
        id: 'R202',
        name: 'Conference Hall',
        x: 55,
        y: 15,
        width: 35,
        height: 40,
        assets: [
          { 
            id: 'A203', 
            name: 'Video Conferencing System', 
            status: 'maintenance', 
            condition: 'Fair', 
            lastUser: 'IT Support', 
            category: 'other', 
            lastMaintenance: '2025-09-29', 
            value: '$4,500', 
            positionInRoom: { x: 50, y: 30 },
            location: 'Floor 2, Conference Hall',
            floor: '2',
            room: 'Conference Hall',
            roomId: 'R202',
            type: 'Conference Equipment',
            lastUpdated: '2025-09-29 11:00'
          },
          { 
            id: 'A204', 
            name: 'Sound System', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'HR Team', 
            category: 'other', 
            lastMaintenance: '2025-09-01', 
            value: '$1,800', 
            positionInRoom: { x: 30, y: 60 },
            location: 'Floor 2, Conference Hall',
            floor: '2',
            room: 'Conference Hall',
            roomId: 'R202',
            type: 'Audio Equipment',
            lastUpdated: '2025-09-01 15:20'
          },
          { 
            id: 'A211', 
            name: 'Conference Table', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'Meeting', 
            category: 'furniture', 
            lastMaintenance: '2025-05-15', 
            value: '$2,600', 
            positionInRoom: { x: 50, y: 50 },
            location: 'Floor 2, Conference Hall',
            floor: '2',
            room: 'Conference Hall',
            roomId: 'R202',
            type: 'Furniture',
            lastUpdated: '2025-05-15 10:00'
          },
        ]
      },
      {
        id: 'R203',
        name: 'HR Department',
        x: 15,
        y: 55,
        width: 40,
        height: 30,
        assets: [
          { 
            id: 'A205', 
            name: 'Laptop #52', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'HR Manager', 
            category: 'laptop', 
            lastMaintenance: '2025-09-08', 
            value: '$1,350', 
            positionInRoom: { x: 35, y: 40 },
            location: 'Floor 2, HR Department',
            floor: '2',
            room: 'HR Department',
            roomId: 'R203',
            type: 'Computing Device',
            lastUpdated: '2025-09-08 13:45'
          },
          { 
            id: 'A206', 
            name: 'Scanner #4', 
            status: 'lost', 
            condition: 'Unknown', 
            lastUser: 'Unknown', 
            category: 'other', 
            lastMaintenance: '2025-07-12', 
            value: '$420', 
            positionInRoom: { x: 65, y: 55 },
            location: 'Unknown',
            floor: '2',
            room: 'HR Department',
            roomId: 'R203',
            type: 'Office Equipment',
            lastUpdated: '2025-07-12 10:30'
          },
        ]
      },
    ],
    stats: { total: 8, active: 6, maintenance: 1, lostDamaged: 1 }
  },
  {
    floor: '3',
    rooms: [
      {
        id: 'R301',
        name: 'Training Room',
        x: 10,
        y: 25,
        width: 35,
        height: 35,
        assets: [
          { 
            id: 'A301', 
            name: 'Laptop #65', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'Training Dept', 
            category: 'laptop', 
            lastMaintenance: '2025-09-05', 
            value: '$1,200', 
            positionInRoom: { x: 30, y: 35 },
            location: 'Floor 3, Training Room',
            floor: '3',
            room: 'Training Room',
            roomId: 'R301',
            type: 'Computing Device',
            lastUpdated: '2025-09-05 09:30'
          },
          { 
            id: 'A302', 
            name: 'Laptop #66', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'Training Dept', 
            category: 'laptop', 
            lastMaintenance: '2025-09-06', 
            value: '$1,250', 
            positionInRoom: { x: 55, y: 35 },
            location: 'Floor 3, Training Room',
            floor: '3',
            room: 'Training Room',
            roomId: 'R301',
            type: 'Computing Device',
            lastUpdated: '2025-09-06 11:00'
          },
          { 
            id: 'A303', 
            name: 'Projector #5', 
            status: 'maintenance', 
            condition: 'Fair', 
            lastUser: 'Trainer', 
            category: 'other', 
            lastMaintenance: '2025-09-30', 
            value: '$1,850', 
            positionInRoom: { x: 42, y: 65 },
            location: 'Floor 3, Training Room',
            floor: '3',
            room: 'Training Room',
            roomId: 'R301',
            type: 'Presentation Equipment',
            lastUpdated: '2025-09-30 14:20'
          },
        ]
      },
      {
        id: 'R302',
        name: 'R&D Lab',
        x: 55,
        y: 20,
        width: 30,
        height: 45,
        assets: [
          { 
            id: 'A304', 
            name: 'Workstation #8', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'Engineer A', 
            category: 'laptop', 
            lastMaintenance: '2025-09-20', 
            value: '$3,200', 
            positionInRoom: { x: 40, y: 40 },
            location: 'Floor 3, R&D Lab',
            floor: '3',
            room: 'R&D Lab',
            roomId: 'R302',
            type: 'Computing Device',
            lastUpdated: '2025-09-20 10:15'
          },
          { 
            id: 'A305', 
            name: 'Testing Equipment', 
            status: 'damaged', 
            condition: 'Poor', 
            lastUser: 'QA Team', 
            category: 'other', 
            lastMaintenance: '2025-08-15', 
            value: '$6,500', 
            positionInRoom: { x: 60, y: 60 },
            location: 'Floor 3, R&D Lab',
            floor: '3',
            room: 'R&D Lab',
            roomId: 'R302',
            type: 'Lab Equipment',
            lastUpdated: '2025-08-15 16:40'
          },
        ]
      },
      {
        id: 'R303',
        name: 'Cafeteria',
        x: 10,
        y: 70,
        width: 75,
        height: 20,
        assets: [
          { 
            id: 'A306', 
            name: 'POS System', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'Cafeteria Staff', 
            category: 'other', 
            lastMaintenance: '2025-09-12', 
            value: '$850', 
            positionInRoom: { x: 25, y: 50 },
            location: 'Floor 3, Cafeteria',
            floor: '3',
            room: 'Cafeteria',
            roomId: 'R303',
            type: 'POS Equipment',
            lastUpdated: '2025-09-12 12:00'
          },
          { 
            id: 'A307', 
            name: 'Refrigerator', 
            status: 'active', 
            condition: 'Good', 
            lastUser: 'Kitchen', 
            category: 'other', 
            lastMaintenance: '2025-08-20', 
            value: '$1,200', 
            positionInRoom: { x: 50, y: 50 },
            location: 'Floor 3, Cafeteria',
            floor: '3',
            room: 'Cafeteria',
            roomId: 'R303',
            type: 'Kitchen Equipment',
            lastUpdated: '2025-08-20 08:00'
          },
          { 
            id: 'A308', 
            name: 'Coffee Machine', 
            status: 'active', 
            condition: 'Excellent', 
            lastUser: 'Staff', 
            category: 'other', 
            lastMaintenance: '2025-09-01', 
            value: '$650', 
            positionInRoom: { x: 75, y: 50 },
            location: 'Floor 3, Cafeteria',
            floor: '3',
            room: 'Cafeteria',
            roomId: 'R303',
            type: 'Kitchen Equipment',
            lastUpdated: '2025-09-01 07:30'
          },
        ]
      },
    ],
    stats: { total: 8, active: 6, maintenance: 1, lostDamaged: 1 }
  },
];

// Helper function to get all assets as a flat array
export const getAllAssets = (): Asset[] => {
  const assets: Asset[] = [];
  mockFloorData.forEach(floor => {
    floor.rooms.forEach(room => {
      assets.push(...room.assets);
    });
  });
  return assets;
};

// Helper function to get asset by ID
export const getAssetById = (assetId: string): Asset | undefined => {
  const allAssets = getAllAssets();
  return allAssets.find(asset => asset.id === assetId);
};

// Helper function to get room by ID
export const getRoomById = (roomId: string): Room | undefined => {
  for (const floor of mockFloorData) {
    const room = floor.rooms.find(r => r.id === roomId);
    if (room) return room;
  }
  return undefined;
};
