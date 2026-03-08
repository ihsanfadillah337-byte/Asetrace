import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Notifications() {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const unreadNotifications = notifications.filter(n => !n.read_status);
  const readNotifications = notifications.filter(n => n.read_status);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'borrow_approved':
        return '✅';
      case 'borrow_rejected':
        return '❌';
      case 'borrow_returned':
        return '🔄';
      case 'maintenance_due':
        return '🔧';
      case 'maintenance_completed':
        return '✨';
      case 'asset_status_changed':
        return '⚠️';
      case 'usage_alert':
        return '📊';
      default:
        return '🔔';
    }
  };

  const getNotificationBadgeVariant = (type: string): any => {
    switch (type) {
      case 'borrow_rejected':
      case 'asset_status_changed':
        return 'destructive';
      case 'maintenance_due':
        return 'secondary';
      case 'borrow_approved':
      case 'maintenance_completed':
        return 'default';
      default:
        return 'outline';
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read_status) {
      markAsRead(notification.id);
    }

    if (notification.related_entity_type === 'asset' && notification.related_entity_id) {
      navigate(`/asset/${notification.related_entity_id}`);
    } else if (notification.related_entity_type === 'borrow_request') {
      navigate('/borrow-history');
    } else if (notification.related_entity_type === 'maintenance') {
      navigate('/maintenance');
    }
  };

  const NotificationList = ({ items }: { items: any[] }) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No notifications</p>
          <p className="text-sm mt-1">You're all caught up!</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                !notification.read_status ? 'bg-primary/5 border-primary/20' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">
                        {notification.title}
                      </h3>
                      <Badge variant={getNotificationBadgeVariant(notification.type)} className="text-xs">
                        {notification.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {!notification.read_status && (
                      <div className="w-3 h-3 bg-primary rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with your asset activities
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={markAllAsRead}
            className="gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="relative">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {notifications.length > 99 ? '99+' : notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">
            Read
            {readNotifications.length > 0 && (
              <Badge variant="outline" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {readNotifications.length > 99 ? '99+' : readNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <NotificationList items={notifications} />
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <NotificationList items={unreadNotifications} />
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <NotificationList items={readNotifications} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
