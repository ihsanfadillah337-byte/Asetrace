import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border-2 px-3 py-1 text-xs font-semibold transition-smooth focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        secondary: "border-secondary/30 bg-secondary/10 text-secondary-foreground hover:bg-secondary/20",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
        success: "border-success/30 bg-success/10 text-success hover:bg-success/20",
        warning: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20",
        outline: "border-border text-foreground hover:bg-accent/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
