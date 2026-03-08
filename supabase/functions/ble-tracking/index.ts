import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BLEScan {
  tag_mac: string;
  rssi: number;
  timestamp: string;
}

interface BLEPayload {
  receiver_id: string;
  receiver_location: {
    room_id: string;
    x: number;
    y: number;
  };
  scans?: BLEScan[];
  heartbeat?: boolean;
}

// ============================================
// PURE LOGIC SETTINGS (Hardware Calibrated)
// ============================================
const RSSI_THRESHOLD_STRONG = -70;    // High confidence
const RSSI_THRESHOLD_MEDIUM = -85;    // Medium confidence
const RSSI_NOISE_FLOOR = -95;         // Noise filter (lowered to -95)

// DEBOUNCE SETTINGS
const DEBOUNCE_MS = 5000;             // 5 seconds - anti-flicker

// TURBO FREE AGENT SETTINGS
const STALE_DATA_THRESHOLD_MS = 12000; // 12 seconds - data lama dianggap "basi"

// Gateway heartbeat thresholds
const GATEWAY_ONLINE_THRESHOLD = 15000;
const GATEWAY_STALE_THRESHOLD = 45000;

// CLEANUP SETTINGS
const BUFFER_CLEANUP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - buffer data older than this is deleted

// Helper: Create notification for admins/operators
async function createNotificationForAdmins(
  supabase: any,
  type: string,
  title: string,
  message: string,
  entityType: string | null = null,
  entityId: string | null = null
) {
  try {
    const { data: adminUsers, error: usersError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'operator']);

    if (usersError || !adminUsers?.length) {
      console.log('No admin/operator users found for notification');
      return;
    }

    const notifications = adminUsers.map((user: any) => ({
      user_id: user.user_id,
      type,
      title,
      message,
      related_entity_type: entityType,
      related_entity_id: entityId,
      read_status: false,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error creating notifications:', insertError);
    } else {
      console.log(`Created ${notifications.length} notifications for type: ${type}`);
    }
  } catch (err) {
    console.error('Error in createNotificationForAdmins:', err);
  }
}

// Helper: Lazy Buffer Cleanup - delete old buffer entries and detect untracked assets
async function lazyBufferCleanup(supabase: any) {
  const cutoffTime = new Date(Date.now() - BUFFER_CLEANUP_THRESHOLD_MS).toISOString();
  
  try {
    // Step 1: Get assets that have buffer data BEFORE cleanup (to detect who becomes empty)
    const { data: assetsWithBuffer } = await supabase
      .from('ble_rssi_buffer')
      .select('tag_mac')
      .gte('created_at', cutoffTime);
    
    const activeTagMacs = new Set((assetsWithBuffer || []).map((b: any) => b.tag_mac));
    
    // Step 2: Delete old buffer entries
    const { data: deletedRows, error: deleteError } = await supabase
      .from('ble_rssi_buffer')
      .delete()
      .lt('created_at', cutoffTime)
      .select('tag_mac');

    if (deleteError) {
      console.error('[CLEANUP] Error deleting old buffer:', deleteError);
      return;
    }

    if (deletedRows && deletedRows.length > 0) {
      const uniqueDeletedMacs = Array.from(new Set(deletedRows.map((r: any) => String(r.tag_mac))));
      console.log(`[CLEANUP] Deleted ${deletedRows.length} old buffer entries for ${uniqueDeletedMacs.length} tags`);
      
      // Step 3: Check which assets now have EMPTY buffers (became untracked)
      for (let i = 0; i < uniqueDeletedMacs.length; i++) {
        const tagMac = uniqueDeletedMacs[i];
        // Skip if this tag still has fresh data
        if (activeTagMacs.has(tagMac)) continue;
        
        // Check if buffer is now completely empty for this tag
        const { data: remainingBuffer } = await supabase
          .from('ble_rssi_buffer')
          .select('id')
          .eq('tag_mac', tagMac)
          .limit(1);
        
        if (!remainingBuffer || remainingBuffer.length === 0) {
          // Buffer is empty! This asset is now UNTRACKED
          await handleUntrackedAsset(supabase, tagMac as string);
        }
      }
    }
  } catch (err) {
    console.error('[CLEANUP] Error in lazyBufferCleanup:', err);
  }
}

// Helper: Handle asset that became untracked (no buffer data)
async function handleUntrackedAsset(supabase: any, tagMac: string) {
  try {
    // Find the asset
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id, name, room, status')
      .eq('ble_tag_mac', tagMac)
      .maybeSingle();

    if (assetError || !asset) {
      console.log(`[UNTRACKED] No asset found for tag: ${tagMac}`);
      return;
    }

    // Skip if already untracked or lost
    if (asset.status === 'untracked' || asset.status === 'lost') {
      return;
    }

    const lastRoom = asset.room || 'Unknown';
    console.log(`[UNTRACKED] 🚨 Asset "${asset.name}" lost signal! Last room: ${lastRoom}`);

    // Update asset status to untracked
    await supabase
      .from('assets')
      .update({ 
        status: 'untracked',
        updated_at: new Date().toISOString()
      })
      .eq('id', asset.id);

    // Clear asset location
    await supabase
      .from('asset_locations')
      .delete()
      .eq('asset_id', asset.id);

    // Log activity: Status changed to untracked
    await supabase
      .from('asset_usage_logs')
      .insert({
        asset_id: asset.id,
        user_name: 'SYSTEM',
        location: lastRoom,
        notes: `[SYSTEM_ALERT] Signal lost! Status changed to UNTRACKED. Last known location: ${lastRoom}`,
        started_at: new Date().toISOString(),
        duration_hours: 0
      });
    console.log(`[ACTIVITY-LOG] Recorded signal lost event for ${asset.name}`);

    // Check if there's an active borrower (accountability check)
    const { data: activeBorrow } = await supabase
      .from('borrow_requests')
      .select(`
        id,
        students:student_id (full_name)
      `)
      .eq('asset_id', asset.id)
      .in('status', ['Approved', 'Active'])
      .maybeSingle();

    let notificationMessage: string;
    let notificationType: string;

    if (activeBorrow && activeBorrow.students) {
      // There's a responsible borrower
      const borrowerName = (activeBorrow.students as any).full_name || 'Unknown';
      notificationMessage = `🚨 SECURITY ALERT: Aset "${asset.name}" hilang sinyal! Penanggung jawab: ${borrowerName}. Terakhir di: ${lastRoom}.`;
      notificationType = 'security_alert';
      console.log(`[UNTRACKED] Security alert - Borrower: ${borrowerName}`);
    } else {
      // No borrower - general warning
      notificationMessage = `⚠️ WARNING: Aset "${asset.name}" hilang pantauan dari ${lastRoom}.`;
      notificationType = 'signal_lost';
      console.log(`[UNTRACKED] Warning - No active borrower`);
    }

    // Create notification for admins
    await createNotificationForAdmins(
      supabase,
      notificationType,
      'Asset Signal Lost',
      notificationMessage,
      'asset',
      asset.id
    );

  } catch (err) {
    console.error('[UNTRACKED] Error handling untracked asset:', err);
  }
}

// Helper: Update gateway heartbeat and status with auto-registration
async function updateGatewayStatus(supabase: any, receiver_id: string, room_id: string) {
  const now = new Date().toISOString();
  
  const { data: existing } = await supabase
    .from('ble_gateways')
    .select('scan_count')
    .eq('receiver_id', receiver_id)
    .maybeSingle();

  const newScanCount = existing ? (existing.scan_count || 0) + 1 : 1;
  
  const { error } = await supabase
    .from('ble_gateways')
    .upsert({
      receiver_id,
      room_id,
      last_seen: now,
      status: 'online',
      scan_count: newScanCount,
      updated_at: now
    }, {
      onConflict: 'receiver_id'
    });

  if (error) {
    console.error('Error updating gateway status:', error);
  } else {
    console.log(`Gateway ${receiver_id} heartbeat - scan count: ${newScanCount}, room: ${room_id}`);
  }

  await updateStaleGateways(supabase);
}

// Helper: Mark gateways as stale/offline
async function updateStaleGateways(supabase: any) {
  const now = Date.now();
  const staleThreshold = new Date(now - GATEWAY_STALE_THRESHOLD).toISOString();
  const onlineThreshold = new Date(now - GATEWAY_ONLINE_THRESHOLD).toISOString();

  const { data: staleUpdated } = await supabase
    .from('ble_gateways')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .lt('last_seen', onlineThreshold)
    .gte('last_seen', staleThreshold)
    .eq('status', 'online')
    .select('receiver_id');

  if (staleUpdated && staleUpdated.length > 0) {
    console.log(`Marked ${staleUpdated.length} gateways as STALE:`, staleUpdated.map((g: any) => g.receiver_id));
  }

  const { data: offlineUpdated } = await supabase
    .from('ble_gateways')
    .update({ status: 'offline', updated_at: new Date().toISOString() })
    .lt('last_seen', staleThreshold)
    .neq('status', 'offline')
    .select('receiver_id');

  if (offlineUpdated && offlineUpdated.length > 0) {
    console.log(`Marked ${offlineUpdated.length} gateways as OFFLINE:`, offlineUpdated.map((g: any) => g.receiver_id));
  }
}

// Helper: Store RSSI in buffer for averaging
async function storeRSSIBuffer(supabase: any, tag_mac: string, receiver_id: string, rssi: number) {
  if (rssi >= RSSI_NOISE_FLOOR) {
    await supabase
      .from('ble_rssi_buffer')
      .insert({
        tag_mac,
        receiver_id,
        rssi,
        timestamp: new Date().toISOString()
      });
  }
}

// ============================================
// PURE LOGIC: Strongest Wins + Time Debounce
// ============================================
async function determineRoomPureLogic(
  supabase: any, 
  tag_mac: string, 
  asset_id: string,
  new_receiver_id: string,
  new_rssi: number,
  new_room_id: string
): Promise<{ shouldMove: boolean; roomData: any | null; reason: string }> {
  
  // Get gateway's room info
  const { data: gateway } = await supabase
    .from('ble_gateways')
    .select('room_id')
    .eq('receiver_id', new_receiver_id)
    .maybeSingle();

  if (!gateway || !gateway.room_id) {
    return { shouldMove: false, roomData: null, reason: 'Gateway not registered or has no room' };
  }

  // Calculate confidence
  let confidence = 'low';
  if (new_rssi > RSSI_THRESHOLD_STRONG) confidence = 'high';
  else if (new_rssi > RSSI_THRESHOLD_MEDIUM) confidence = 'medium';

  // Get current location
  const { data: currentLocation } = await supabase
    .from('asset_locations')
    .select('room_id, rssi, receiver_id, updated_at')
    .eq('asset_id', asset_id)
    .maybeSingle();

  // ============================================
  // CASE 1: First detection - no previous location
  // ============================================
  if (!currentLocation) {
    console.log(`[PURE-LOGIC] Tag ${tag_mac} - First detection at ${gateway.room_id}`);
    return {
      shouldMove: true,
      roomData: {
        receiver_id: new_receiver_id,
        room_id: gateway.room_id,
        rssi: new_rssi,
        confidence
      },
      reason: 'First detection - no previous location'
    };
  }

  // ============================================
  // CASE 2: Same room - just update RSSI
  // ============================================
  if (currentLocation.room_id === gateway.room_id) {
    return {
      shouldMove: true,
      roomData: {
        receiver_id: new_receiver_id,
        room_id: gateway.room_id,
        rssi: new_rssi,
        confidence,
        sameRoom: true
      },
      reason: 'Same room - updating RSSI only'
    };
  }

  // ============================================
  // CASE 3: Different room - Apply DEBOUNCE + STRONGEST WINS
  // ============================================
  const currentRSSI = currentLocation.rssi || -100;
  const lastUpdateTime = currentLocation.updated_at ? new Date(currentLocation.updated_at).getTime() : 0;
  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  
  console.log(`[PURE-LOGIC] Tag ${tag_mac} - Movement check:`);
  console.log(`  Current: ${currentLocation.receiver_id} @ ${currentRSSI} dBm (room: ${currentLocation.room_id})`);
  console.log(`  Candidate: ${new_receiver_id} @ ${new_rssi} dBm (room: ${gateway.room_id})`);
  console.log(`  Time since last update: ${Math.round(timeSinceLastUpdate / 1000)}s`);

  // DEBOUNCE CHECK: If recently updated, reject
  if (timeSinceLastUpdate < DEBOUNCE_MS) {
    const remainingMs = DEBOUNCE_MS - timeSinceLastUpdate;
    console.log(`[PURE-LOGIC] ❌ DEBOUNCE: Wait ${Math.round(remainingMs / 1000)}s more before allowing move`);
    return {
      shouldMove: false,
      roomData: null,
      reason: `Debounce active - wait ${Math.round(remainingMs / 1000)}s (last update: ${Math.round(timeSinceLastUpdate / 1000)}s ago)`
    };
  }

  // ============================================
  // TURBO FREE AGENT LOGIC
  // ============================================
  const isDataStale = timeSinceLastUpdate >= STALE_DATA_THRESHOLD_MS;
  
  if (isDataStale) {
    // CASE B: Data Lama Sudah Basi (> 12 detik)
    // FREE AGENT MODE: Gateway lama sudah kehilangan jejak
    // Izinkan pindah ASALKAN sinyal valid (> -95 dBm / RSSI_NOISE_FLOOR)
    console.log(`[FREE-AGENT] 🆓 Data stale (${Math.round(timeSinceLastUpdate / 1000)}s > ${STALE_DATA_THRESHOLD_MS / 1000}s)`);
    console.log(`[FREE-AGENT] ✅ MOVE APPROVED: Signal ${new_rssi} dBm > noise floor ${RSSI_NOISE_FLOOR} dBm (weak signals allowed)`);
    return {
      shouldMove: true,
      roomData: {
        receiver_id: new_receiver_id,
        room_id: gateway.room_id,
        rssi: new_rssi,
        confidence
      },
      reason: `FREE AGENT: Data stale ${Math.round(timeSinceLastUpdate / 1000)}s, signal ${new_rssi} dBm valid`
    };
  } else {
    // CASE A: Data Masih Segar (< 12 detik)
    // STRONGEST WINS: Kompetisi normal - siapa lebih kuat, menang
    if (new_rssi > currentRSSI) {
      console.log(`[PURE-LOGIC] ✅ MOVE APPROVED: ${new_rssi} > ${currentRSSI} (strongest wins)`);
      return {
        shouldMove: true,
        roomData: {
          receiver_id: new_receiver_id,
          room_id: gateway.room_id,
          rssi: new_rssi,
          confidence
        },
        reason: `Strongest wins: ${new_rssi} dBm > ${currentRSSI} dBm`
      };
    } else {
      console.log(`[PURE-LOGIC] ❌ REJECTED: ${new_rssi} <= ${currentRSSI} (current location stronger, data fresh)`);
      return {
        shouldMove: false,
        roomData: null,
        reason: `Current location stronger: ${currentRSSI} dBm >= ${new_rssi} dBm (data fresh: ${Math.round(timeSinceLastUpdate / 1000)}s)`
      };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BLEPayload = await req.json();
    console.log('Received BLE tracking data:', JSON.stringify(payload, null, 2));

    if (!payload.receiver_id || !payload.receiver_location || !payload.receiver_location.room_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload structure: missing receiver_id or receiver_location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await updateGatewayStatus(supabase, payload.receiver_id, payload.receiver_location.room_id);

    // Lazy Buffer Cleanup: Delete old data & detect untracked assets
    await lazyBufferCleanup(supabase);

    if (!payload.scans || !Array.isArray(payload.scans) || payload.scans.length === 0) {
      console.log(`Gateway ${payload.receiver_id} heartbeat only - no assets detected`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Heartbeat recorded',
          gateway: payload.receiver_id,
          room_id: payload.receiver_location.room_id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const scan of payload.scans) {
      const { tag_mac, rssi, timestamp } = scan;

      // ============================================
      // NOISE FLOOR CUT-OFF: IGNORE WEAK SIGNALS
      // ============================================
      if (rssi < RSSI_NOISE_FLOOR) {
        console.log(`[NOISE-FILTER] ❌ REJECTED: ${tag_mac} from ${payload.receiver_id} @ ${rssi} dBm (below noise floor ${RSSI_NOISE_FLOOR})`);
        results.push({
          tag_mac,
          receiver_id: payload.receiver_id,
          rssi,
          status: 'REJECTED',
          reason: `RSSI ${rssi} dBm below noise floor (${RSSI_NOISE_FLOOR} dBm)`
        });
        continue;
      }

      console.log(`[NOISE-FILTER] ✅ ACCEPTED: ${tag_mac} from ${payload.receiver_id} @ ${rssi} dBm`);

      // Store in buffer
      await storeRSSIBuffer(supabase, tag_mac, payload.receiver_id, rssi);

      // Find asset with full status
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('id, name, status, room')
        .eq('ble_tag_mac', tag_mac)
        .maybeSingle();

      if (assetError || !asset) {
        console.log(`Asset not found for MAC: ${tag_mac}`);
        results.push({
          tag_mac,
          rssi,
          status: 'SKIPPED',
          reason: 'Asset not registered'
        });
        continue;
      }

      // ============================================
      // AUTO-RECOVERY: Untracked/Lost Asset Detected Again!
      // ============================================
      const isRecovery = ['untracked', 'lost'].includes(asset.status);
      if (isRecovery) {
        console.log(`[AUTO-RECOVERY] 🎉 Asset "${asset.name}" (${tag_mac}) detected after being ${asset.status}!`);
        
        // Get room info for recovery notification
        const { data: recoveryRoom } = await supabase
          .from('rooms')
          .select('room_name, floor, position_x, position_y')
          .eq('id', payload.receiver_location.room_id)
          .maybeSingle();

        const lastRoom = asset.room || 'Unknown';
        const recoveryRoomName = recoveryRoom?.room_name || payload.receiver_location.room_id;

        // Update asset status to active immediately
        await supabase
          .from('assets')
          .update({ 
            status: 'active',
            room: recoveryRoomName,
            room_id: payload.receiver_location.room_id,
            floor: recoveryRoom?.floor || 'Unknown',
            position_x: recoveryRoom?.position_x,
            position_y: recoveryRoom?.position_y,
            updated_at: new Date().toISOString()
          })
          .eq('id', asset.id);

        // Update/insert asset location
        await supabase
          .from('asset_locations')
          .upsert({
            asset_id: asset.id,
            tag_mac: tag_mac,
            room_id: payload.receiver_location.room_id,
            receiver_id: payload.receiver_id,
            rssi: rssi,
            confidence: rssi > RSSI_THRESHOLD_STRONG ? 'high' : rssi > RSSI_THRESHOLD_MEDIUM ? 'medium' : 'low',
            updated_at: new Date().toISOString()
          }, { onConflict: 'asset_id' });

        // Record movement history
        await supabase
          .from('asset_movement_history')
          .insert({
            asset_id: asset.id,
            from_room_id: null,
            to_room_id: payload.receiver_location.room_id,
            from_room_name: `Lost Signal (${lastRoom})`,
            to_room_name: recoveryRoomName,
            detected_by: payload.receiver_id,
            rssi: rssi,
            moved_at: new Date().toISOString()
          });

        // Log activity: Asset recovered
        await supabase
          .from('asset_usage_logs')
          .insert({
            asset_id: asset.id,
            user_name: 'SYSTEM',
            location: recoveryRoomName,
            notes: `[SYSTEM_RECOVERY] ✅ Asset recovered! Signal regained at ${recoveryRoomName}. Previously lost from ${lastRoom}.`,
            started_at: new Date().toISOString(),
            duration_hours: 0
          });
        console.log(`[ACTIVITY-LOG] Recorded recovery event for ${asset.name}`);

        // Send recovery notification to admins
        await createNotificationForAdmins(
          supabase,
          'asset_recovery',
          '✅ Asset Recovered!',
          `✅ RECOVERY: Aset "${asset.name}" kembali terdeteksi di ${recoveryRoomName} setelah sempat hilang dari ${lastRoom}.`,
          'asset',
          asset.id
        );

        console.log(`[AUTO-RECOVERY] ✅ ${asset.name} recovered at ${recoveryRoomName}`);

        results.push({
          asset_id: asset.id,
          asset_name: asset.name,
          room: recoveryRoomName,
          rssi,
          status: 'RECOVERED',
          reason: `Auto-recovery: Asset was ${asset.status}, now active at ${recoveryRoomName}`
        });

        // Skip normal location logic for this frame - recovery takes priority
        continue;
      }

      // Record raw tracking data (for history/debugging)
      await supabase
        .from('ble_tracking_data')
        .insert({
          asset_id: asset.id,
          receiver_id: payload.receiver_id,
          tag_mac: tag_mac,
          rssi: rssi, // Use raw RSSI (hardware calibrated)
          receiver_location: payload.receiver_location,
          timestamp: timestamp || new Date().toISOString(),
        });

      // ============================================
      // PURE LOGIC: Determine if location should change
      // ============================================
      const { shouldMove, roomData, reason } = await determineRoomPureLogic(
        supabase, 
        tag_mac, 
        asset.id,
        payload.receiver_id,
        rssi,
        payload.receiver_location.room_id
      );

      if (shouldMove && roomData) {
        const { data: currentLocation } = await supabase
          .from('asset_locations')
          .select('room_id')
          .eq('asset_id', asset.id)
          .maybeSingle();

        const previousRoomId = currentLocation?.room_id;
        const isActualMove = previousRoomId && previousRoomId !== roomData.room_id;

        // Update asset location
        const { error: locationError } = await supabase
          .from('asset_locations')
          .upsert({
            asset_id: asset.id,
            tag_mac: tag_mac,
            room_id: roomData.room_id,
            receiver_id: roomData.receiver_id,
            rssi: roomData.rssi,
            confidence: roomData.confidence,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'asset_id'
          });

        if (locationError) {
          console.error('Error updating asset location:', locationError);
        }

        // Get room details
        const { data: room } = await supabase
          .from('rooms')
          .select('position_x, position_y, room_name, floor')
          .eq('id', roomData.room_id)
          .maybeSingle();

        if (room) {
          // Get asset's home_base (original room_id) for Ghost Asset detection
          const { data: fullAsset } = await supabase
            .from('assets')
            .select('id, name, room_id, status')
            .eq('id', asset.id)
            .maybeSingle();
          
          const homeBaseRoomId = fullAsset?.room_id;
          const assetStatus = fullAsset?.status;
          
          // Update asset position
          await supabase
            .from('assets')
            .update({
              position_x: room.position_x,
              position_y: room.position_y,
              room_id: roomData.room_id,
              room: room.room_name,
              floor: room.floor,
              updated_at: new Date().toISOString(),
            })
            .eq('id', asset.id);

          // Record movement history ONLY if actual room change
          if (isActualMove) {
            const { data: prevRoom } = await supabase
              .from('rooms')
              .select('room_name')
              .eq('id', previousRoomId)
              .maybeSingle();

            await supabase
              .from('asset_movement_history')
              .insert({
                asset_id: asset.id,
                from_room_id: previousRoomId,
                to_room_id: roomData.room_id,
                from_room_name: prevRoom?.room_name || 'Unknown',
                to_room_name: room.room_name,
                detected_by: roomData.receiver_id,
                rssi: roomData.rssi,
                moved_at: new Date().toISOString()
              });

            console.log(`[MOVEMENT] ${asset.name} moved: ${prevRoom?.room_name || 'Unknown'} → ${room.room_name} (RSSI: ${roomData.rssi})`);

            // Notify admins of movement
            await createNotificationForAdmins(
              supabase,
              'asset_movement',
              'Asset Movement Detected',
              `${asset.name} moved from ${prevRoom?.room_name || 'Unknown'} to ${room.room_name}`,
              'movement',
              asset.id
            );
          }

          // ============================================
          // GHOST ASSET DETECTION
          // Check if asset is in wrong room (not home_base)
          // Safe zones: Admin, Server, Warehouse, Storage
          // ============================================
          const SAFE_ZONE_KEYWORDS = ['admin', 'server', 'warehouse', 'storage'];
          const roomNameLower = room.room_name.toLowerCase();
          const isSafeZone = SAFE_ZONE_KEYWORDS.some(keyword => roomNameLower.includes(keyword));
          const isAvailable = ['active', 'idle'].includes(assetStatus || '');
          
          // Ghost Asset: Available asset in wrong room (not safe zone)
          if (isAvailable && homeBaseRoomId && homeBaseRoomId !== roomData.room_id && !isSafeZone) {
            console.log(`[GHOST-ASSET] ⚠️ ${asset.name} detected in wrong room! Home: ${homeBaseRoomId}, Current: ${roomData.room_id}`);
            
            // Get home base room name for the notification
            const { data: homeRoom } = await supabase
              .from('rooms')
              .select('room_name')
              .eq('id', homeBaseRoomId)
              .maybeSingle();
            
            await createNotificationForAdmins(
              supabase,
              'ghost_asset',
              '⚠️ Ghost Asset Detected',
              `Aset "${asset.name}" terdeteksi di ${room.room_name}, seharusnya di ${homeRoom?.room_name || 'Unknown'}. Compliance violation!`,
              'asset',
              asset.id
            );
          }

          console.log(`[UPDATE] ${asset.name} → ${room.room_name} on ${room.floor} (RSSI: ${roomData.rssi}, confidence: ${roomData.confidence})`);
          
          results.push({
            asset_id: asset.id,
            asset_name: asset.name,
            room: room.room_name,
            floor: room.floor,
            rssi: roomData.rssi,
            confidence: roomData.confidence,
            status: isActualMove ? 'MOVED' : 'UPDATED',
            reason,
            ghost_asset: isAvailable && homeBaseRoomId && homeBaseRoomId !== roomData.room_id && !isSafeZone
          });
        }
      } else {
        console.log(`[NO-CHANGE] ${asset.name} - ${reason}`);
        results.push({
          asset_id: asset.id,
          asset_name: asset.name,
          rssi,
          status: 'NO_CHANGE',
          reason
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${payload.scans.length} scans`,
        logic: 'TURBO_FREE_AGENT',
        noise_floor: RSSI_NOISE_FLOOR,
        debounce_seconds: DEBOUNCE_MS / 1000,
        stale_threshold_seconds: STALE_DATA_THRESHOLD_MS / 1000,
        results 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ble-tracking function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
