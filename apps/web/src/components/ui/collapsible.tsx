"use client";

// Collapsible — no Radix dependency, pure React
import * as React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleContextValue {
  open: boolean;
  toggle: () => void;
}
const CollapsibleCtx = React.createContext<CollapsibleContextValue>({
  open: false,
  toggle: () => {}
});

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function Collapsible({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
  className,
  asChild: _asChild,
  ...props
}: CollapsibleProps & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = React.useCallback(() => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, isControlled, onOpenChange]);

  if (_asChild && React.isValidElement(children)) {
    return (
      <CollapsibleCtx.Provider value={{ open: isOpen, toggle }}>
        {children}
      </CollapsibleCtx.Provider>
    );
  }

  return (
    <CollapsibleCtx.Provider value={{ open: isOpen, toggle }}>
      <div className={className} {...props}>
        {children}
      </div>
    </CollapsibleCtx.Provider>
  );
}

interface CollapsibleTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleTrigger({
  asChild,
  children,
  className,
  ...props
}: CollapsibleTriggerProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const { toggle } = React.useContext(CollapsibleCtx);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: toggle
    });
  }

  return (
    <button
      type="button"
      className={cn("", className)}
      onClick={toggle}
      {...props}
    >
      {children}
    </button>
  );
}

interface CollapsibleContentProps {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleContent({
  asChild,
  children,
  className,
  ...props
}: CollapsibleContentProps & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const { open } = React.useContext(CollapsibleCtx);

  if (!open) return null;

  if (asChild && React.isValidElement(children)) {
    return children;
  }

  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
