import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
  onClick?: () => void;
}

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  variant = 'default',
  className,
  onClick
}: MetricCardProps) {
  const variantStyles = {
    default: 'border-l-4 border-l-primary bg-gradient-to-br from-card to-primary/5',
    success: 'border-l-4 border-l-success bg-gradient-to-br from-card to-success/5',
    warning: 'border-l-4 border-l-warning bg-gradient-to-br from-card to-warning/5',
    destructive: 'border-l-4 border-l-destructive bg-gradient-to-br from-card to-destructive/5'
  };

  const iconBgStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive'
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Card 
        className={cn(
          'p-6 border-2 border-border/30 shadow-card',
          variantStyles[variant],
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
            {trend && (
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'text-xs flex items-center gap-1 font-semibold',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
              </motion.p>
            )}
          </div>
          <motion.div 
            className={cn('p-3 rounded-xl shadow-glow', iconBgStyles[variant])}
            whileHover={{ rotate: 5, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Icon className="h-6 w-6" />
          </motion.div>
        </div>
      </Card>
    </motion.div>
  );
}