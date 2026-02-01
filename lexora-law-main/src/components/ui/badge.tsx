import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy text-ivory",
        secondary: "border-transparent bg-graphite text-ivory",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-navy border-navy/30",
        // Status variants for Lexora
        new: "border-transparent bg-navy text-ivory",
        inProgress: "border-gold/30 bg-gold/20 text-gold",
        resolved: "border-transparent bg-green text-white",
        sent: "border-transparent bg-graphite text-ivory",
        warning: "border-gold/30 bg-gold/20 text-gold",
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