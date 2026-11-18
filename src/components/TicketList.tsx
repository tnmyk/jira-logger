import { Search } from "lucide-react";
import type { Ticket } from "@/lib/types";
import TicketRow from "./TicketRow";
import { Button, EmptyState, SectionLabel, Skeleton } from "./ui";

type TicketListProps = {
  tickets: Ticket[];
  selectedKey: string | null;
  expandedKey: string | null;
  pins: Set<string>;
  loading: boolean;
  loadingMore: boolean;
  failed: boolean;
  hasMore: boolean;
  onSelect: (key: string) => void;
  onTogglePin: (key: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onReset: () => void;
};

export default function TicketList({
  tickets,
  selectedKey,
  expandedKey,
  pins,
  loading,
  loadingMore,
  failed,
  hasMore,
  onSelect,
  onTogglePin,
  onLoadMore,
  onRetry,
  onReset,
}: TicketListProps) {
  return (
    <section
      aria-label="Ticket results"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="sticky top-0 z-10 flex h-8 shrink-0 items-center justify-between border-b border-border bg-bg px-3 md:px-4">
        <SectionLabel>Tickets</SectionLabel>
        <div className="hidden items-center xl:flex">
          <span className="w-[88px] text-right text-[9.5px] uppercase tracking-[0.08em] text-text-faint">
            Updated
          </span>
          <span className="w-[28px]" />
        </div>
      </div>

      {loading ? (
        <div aria-label="Loading tickets">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="flex h-12 items-center gap-3 border-b border-border px-4 md:px-5"
            >
              <Skeleton className="size-3" />
              <Skeleton className="h-2.5 w-[58px]" />
              <Skeleton className="h-2.5 flex-1" />
              <Skeleton className="hidden h-2.5 w-[70px] sm:block" />
              <Skeleton className="size-5 rounded-full" />
            </div>
          ))}
        </div>
      ) : failed && tickets.length === 0 ? (
        <EmptyState
          title="Search did not complete"
          description="Check the message above, then retry."
          action={
            <Button variant="subtle" size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Search size={18} strokeWidth={1.4} />}
          title="No tickets match"
          description="Adjust the JQL, or start from your open tickets."
          action={
            <Button variant="subtle" size="sm" onClick={onReset}>
              My open tickets
            </Button>
          }
        />
      ) : (
        <>
          <div>
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.key}
                ticket={ticket}
                selected={ticket.key === selectedKey}
                expanded={ticket.key === expandedKey}
                pinned={pins.has(ticket.key)}
                onSelect={() => onSelect(ticket.key)}
                onTogglePin={() => onTogglePin(ticket.key)}
              />
            ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center px-4 py-4">
              <Button
                variant="subtle"
                size="sm"
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : (
            <div className="h-10" />
          )}
        </>
      )}
    </section>
  );
}
