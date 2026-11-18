import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import type { TicketStatusCategory } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "subtle" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[#1b1308] hover:bg-[#dcac6d] active:bg-[#c69352] disabled:bg-[#8b704a]",
  ghost:
    "text-text-muted hover:bg-bg-hover hover:text-text active:bg-bg-selected disabled:text-text-faint",
  subtle:
    "border border-border bg-bg-raised text-text-muted hover:border-border-strong hover:text-text disabled:text-text-faint",
  danger:
    "text-danger hover:bg-danger/10 hover:text-[#e28c7f] active:bg-danger/15 disabled:text-danger/40",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-md px-2.5 text-[12px]",
  md: "h-10 rounded-md px-3 text-[12.5px]",
  icon: "h-9 w-9 rounded-md",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "ghost", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: ButtonVariant;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, className, variant = "ghost", ...props }, ref) {
    return (
      <Button
        ref={ref}
        size="icon"
        variant={variant}
        aria-label={label}
        title={label}
        className={className}
        {...props}
      />
    );
  },
);

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("quiet-input", className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("quiet-input quiet-textarea", className)}
      {...props}
    />
  );
});

export function SectionLabel({
  children,
  count,
  className,
}: {
  children: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.09em] text-text-faint",
        className,
      )}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className="tabular-nums text-text-faint">{count}</span>
      ) : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mono rounded border border-border bg-bg px-1 py-0.5 text-[10px] leading-none text-text-faint">
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-bg-selected/70 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      {icon ? <div className="mb-3 text-text-faint">{icon}</div> : null}
      <p className="text-[13px] font-medium text-text-muted">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[320px] text-[12px] leading-5 text-text-faint">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatusDot({
  category,
  className,
}: {
  category: TicketStatusCategory;
  className?: string;
}) {
  const colors: Record<TicketStatusCategory, string> = {
    todo: "bg-text-faint",
    "in-progress": "bg-accent",
    done: "bg-success",
    unknown: "bg-text-faint/60",
  };
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-1.5 shrink-0 rounded-full", colors[category], className)}
    />
  );
}

export function Monogram({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-[9px] font-medium uppercase text-text-muted",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeOnEscape = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  closeOnEscape?: boolean;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  if (open && !wasOpen.current) {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }
  wasOpen.current = open;

  useLayoutEffect(() => {
    if (!open || previousFocus.current) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, [open]);

  function restoreFocus() {
    const target = previousFocus.current;
    previousFocus.current = null;
    requestAnimationFrame(() => restoreFocusTarget(target));
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border-strong bg-bg-raised p-5 focus:outline-none",
            className,
          )}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          onEscapeKeyDown={(event) => {
            if (!closeOnEscape) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-medium text-text">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[12px] leading-5 text-text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close dialog">
                <X size={15} />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function restoreFocusTarget(target: HTMLElement | null) {
  if (target?.isConnected) {
    target.focus();
    return;
  }
  const detailClose = document.querySelector<HTMLElement>(
    '#ticket-detail button[aria-label="Close ticket detail"]',
  );
  if (detailClose?.getClientRects().length) {
    detailClose.focus();
    return;
  }
  const navigation = document.querySelector<HTMLElement>(
    'button[aria-label="Open navigation"]',
  );
  if (navigation?.getClientRects().length) {
    navigation.focus();
    return;
  }
  const main = document.getElementById("main-content");
  main?.focus();
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="w-[min(400px,calc(100vw-32px))]"
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Deleting…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
