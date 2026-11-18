import { formatDistanceToNowStrict } from "date-fns";
import { Star } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Monogram, StatusDot } from "./ui";

type TicketRowProps = {
  ticket: Ticket;
  selected: boolean;
  expanded: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
};

export default function TicketRow({
  ticket,
  selected,
  expanded,
  pinned,
  onSelect,
  onTogglePin,
}: TicketRowProps) {
  const updated = ticket.updated ? updatedLabel(ticket.updated) : "";

  return (
    <div
      data-ticket-key={ticket.key}
      className={cn(
        "group relative flex h-12 items-center gap-2 border-b border-l-2 border-border px-3 transition-colors duration-150 md:px-4",
        selected
          ? "border-l-accent bg-bg-selected"
          : "border-l-transparent hover:bg-bg-hover",
      )}
    >
      <button
        type="button"
        aria-label={`Open ${ticket.key}: ${ticket.summary}. ${ticket.status}. ${ticket.assignee?.name ?? "Unassigned"}.`}
        aria-current={selected ? "true" : undefined}
        aria-expanded={expanded}
        aria-controls="ticket-detail"
        onClick={onSelect}
        className="absolute inset-0 z-10 cursor-pointer rounded-none"
      />

      <button
        type="button"
        aria-label={pinned ? `Unpin ${ticket.key}` : `Pin ${ticket.key}`}
        title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
        aria-pressed={pinned}
        onClick={onTogglePin}
        className={cn(
          "relative z-20 flex size-9 shrink-0 items-center justify-center rounded-md text-text-faint transition-colors duration-150 hover:bg-bg-selected hover:text-text",
          pinned && "text-accent hover:text-accent",
        )}
      >
        <Star
          size={13}
          fill={pinned ? "currentColor" : "none"}
          strokeWidth={1.6}
        />
      </button>

      <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2">
        <span className="mono w-[74px] shrink-0 text-[10.5px] text-text-muted">
          {ticket.key}
        </span>

        <span
          title={ticket.summary}
          className="min-w-0 flex-1 truncate text-[12.5px] text-text"
        >
          {ticket.summary}
        </span>

        <span className="hidden w-[102px] shrink-0 items-center gap-1.5 md:flex">
          <StatusDot category={ticket.statusCategory} />
          <span className="truncate text-[10.5px] text-text-muted">
            {ticket.status}
          </span>
        </span>

        <span className="hidden w-[84px] shrink-0 truncate text-[10.5px] text-text-faint lg:block">
          {ticket.project?.key ?? ""}
        </span>

        <span className="hidden w-[88px] shrink-0 text-right text-[10px] text-text-faint xl:block">
          {updated}
        </span>

        <Monogram name={ticket.assignee?.name} className="ml-1" />
      </div>
    </div>
  );
}

function updatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNowStrict(date, { addSuffix: true })
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo");
}
