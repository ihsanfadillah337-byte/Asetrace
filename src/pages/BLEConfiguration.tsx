import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bluetooth, Radio, MapPin } from 'lucide-react';
import { TagRegistration } from '@/components/ble/TagRegistration';
import { RSSIMonitor } from '@/components/ble/RSSIMonitor';
import { GatewayManager } from '@/components/ble/GatewayManager';

export default function BLEConfiguration() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">BLE Configuration</h1>
        <p className="text-muted-foreground">
          Manage BLE tags, monitor signal strength, and configure gateway locations
        </p>
      </div>

      <Tabs defaultValue="registration" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="registration" className="gap-2">
            <Bluetooth className="h-4 w-4" />
            Tag Registration
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-2">
            <Radio className="h-4 w-4" />
            RSSI Monitor
          </TabsTrigger>
          <TabsTrigger value="gateways" className="gap-2">
            <MapPin className="h-4 w-4" />
            Gateway Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registration">
          <TagRegistration />
        </TabsContent>

        <TabsContent value="monitor">
          <RSSIMonitor />
        </TabsContent>

        <TabsContent value="gateways">
          <GatewayManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
