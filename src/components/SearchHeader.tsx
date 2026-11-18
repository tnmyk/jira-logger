import { forwardRef, type RefObject } from "react";
import { Menu, Search, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton, Kbd } from "./ui";

type SearchHeaderProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  count: number;
  error?: string | null;
  warning?: string | null;
  onOpenSettings: () => void;
  onOpenNav: () => void;
  navOpen: boolean;
  navButtonRef?: RefObject<HTMLButtonElement | null>;
};

const SearchHeader = forwardRef<HTMLInputElement, SearchHeaderProps>(
  function SearchHeader(
    {
      value,
      onChange,
      onSubmit,
      loading,
      count,
      error,
      warning,
      onOpenSettings,
      onOpenNav,
      navOpen,
      navButtonRef,
    },
    ref,
  ) {
    return (
      <header className="shrink-0 border-b border-border">
        <h1 id="search-heading" tabIndex={-1} className="sr-only">
          Search tickets
        </h1>
        <div className="flex h-12 items-center gap-2 px-4 md:px-5">
          <IconButton
            ref={navButtonRef}
            label="Open navigation"
            aria-expanded={navOpen}
            className="-ml-1 md:hidden"
            onClick={onOpenNav}
          >
            <Menu size={14} />
          </IconButton>
          <Search size={14} className="hidden shrink-0 text-text-faint sm:block" />
          <input
            ref={ref}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            aria-label="Search tickets"
            placeholder="JQL, ticket key, or words — e.g. ABC-123"
            spellCheck={false}
            className="mono min-w-0 flex-1 rounded-sm bg-transparent text-[12px] text-text placeholder:text-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
          />
          {value ? (
            <IconButton
              label="Clear search text"
              onClick={() => {
                onChange("");
                requestAnimationFrame(() => {
                  document
                    .querySelector<HTMLInputElement>(
                      'input[aria-label="Search tickets"]',
                    )
                    ?.focus();
                });
              }}
            >
              <X size={13} />
            </IconButton>
          ) : null}
          <div className="hidden items-center gap-1.5 sm:flex">
            <Kbd>↵</Kbd>
          </div>
          <Button
            size="sm"
            variant="subtle"
            onClick={onSubmit}
            disabled={loading}
            className="ml-1"
          >
            {loading ? "Searching…" : "Search"}
          </Button>
          <IconButton
            label="Settings"
            onClick={onOpenSettings}
            className="md:hidden"
          >
            <Settings2 size={14} />
          </IconButton>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pb-2 md:px-5">
          <p className="text-[10px] text-text-faint">
            {loading
              ? "Searching Jira…"
              : count === 0
                ? "No tickets"
                : `${count} ticket${count === 1 ? "" : "s"}`}
          </p>
          {warning ? (
            <p className="truncate text-[10px] text-warning">{warning}</p>
          ) : (
            <p className="hidden text-[10px] text-text-faint sm:block">
              <span className="mono">/</span> search ·{" "}
              <span className="mono">j k</span> move ·{" "}
              <span className="mono">↵</span> open
            </p>
          )}
        </div>

        {error ? (
          <div className="border-t border-danger/20 bg-danger/5 px-4 py-2 md:px-5">
            <p
              role="alert"
              className={cn("text-[11px] leading-5 text-danger")}
            >
              {error}
            </p>
          </div>
        ) : null}
      </header>
    );
  },
);

export default SearchHeader;
