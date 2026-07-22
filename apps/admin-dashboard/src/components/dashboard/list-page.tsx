// components/dashboard/list-page.tsx
"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  LayoutGrid,
  List as ListIcon,
  Table as TableIcon,
  X,
} from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";
import { TableSkeleton } from "./skeletons";
import { ErrorBoundary, InlineError } from "./error-boundary";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type ViewMode = "table" | "board" | "list";

export type BulkAction = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "outline" | "destructive" | "ghost";
  onClick: () => void;
};

export type ListPageProps<T extends { id: string }> = {
  title: string;
  description?: string;
  eyebrow?: string;
  rows: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  actions?: ReactNode;
  filters?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  isLoading?: boolean;
  error?: Error | null;
  enableViewModes?: boolean;
  defaultViewMode?: ViewMode;
  enableSelection?: boolean;
  enableExport?: boolean;
  enableSearch?: boolean;
  enablePagination?: boolean;
  className?: string;
  renderRowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Header content rendered above the table */
  renderHeader?: ReactNode;
  /** Controlled selection state */
  selectedRows?: Set<string>;
  /** Callback when selection changes */
  onSelectionChange?: (selected: Set<string>) => void;
  /** Bulk action buttons shown when rows are selected */
  bulkActions?: BulkAction[];

  searchPlaceholder?: string;
};

export function ListPage<T extends { id: string }>(props: ListPageProps<T>) {
  return (
    <ErrorBoundary boundary="list_page">
      <ListPageInner {...props} />
    </ErrorBoundary>
  );
}

function ListPageInner<T extends { id: string }>({
  title,
  description,
  eyebrow,
  rows,
  columns,
  searchKeys,
  actions,
  filters,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "Try adjusting search or filters.",
  searchPlaceholder = "Search...",
  pageSize = 15,
  isLoading,
  error: externalError,
  enableViewModes = false,
  defaultViewMode = "table",
  enableSelection = true,
  enableExport = false,
  enableSearch = true,
  enablePagination = true,
  className,
  renderRowActions,
  onRowClick,
  renderHeader,
  selectedRows: controlledSelected,
  onSelectionChange,
  bulkActions,
}: ListPageProps<T>) {
  const { loading: simLoading, error: simError, retry } = useSimulatedLoad();
  const loading = isLoading ?? simLoading;
  const error = externalError ?? simError;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);

  // Use controlled selection if provided, otherwise internal
  const [internalSel, setInternalSel] = useState<Set<string>>(new Set());
  const sel = controlledSelected ?? internalSel;
  const setSel = onSelectionChange ?? setInternalSel;

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      (searchKeys ?? (Object.keys(r) as (keyof T)[]))
        .map((k) => String(r[k] ?? "").toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [q, rows, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const p = Math.min(page, pages);
  const slice = filtered.slice((p - 1) * pageSize, p * pageSize);
  const allChecked = slice.length > 0 && slice.every((r) => sel.has(r.id));
  const totalCount = filtered.length;

  const getPageNumbers = () => {
    const nums: (number | string)[] = [];
    if (pages <= 5) {
      for (let i = 1; i <= pages; i++) nums.push(i);
    } else {
      if (p <= 3) {
        nums.push(1, 2, 3, "...", pages);
      } else if (p >= pages - 2) {
        nums.push(1, "...", pages - 2, pages - 1, pages);
      } else {
        nums.push(1, "...", p, "...", pages);
      }
    }
    return nums;
  };

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    const next = new Set(sel);
    if (checked) next.add(id);
    else next.delete(id);
    setSel(next);
  }, [sel, setSel]);

  const toggleAll = useCallback((checked: boolean) => {
    const next = new Set(sel);
    if (checked) slice.forEach((r) => next.add(r.id));
    else slice.forEach((r) => next.delete(r.id));
    setSel(next);
  }, [sel, setSel, slice]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Page Header */}
      <PageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        actions={actions}
      />

      {/* Render Header (stats, charts, etc.) */}
      {renderHeader}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {enableViewModes && (
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 border">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TableIcon className="size-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "board"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-4" />
              Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListIcon className="size-4" />
              List
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {enableSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-64 pl-9"
              />
            </div>
          )}
          {filters}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {enableSelection && sel.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/40 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2">
          <span className="font-medium">{sel.size} selected</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant}
                className="gap-1.5"
                onClick={action.onClick}
              >
                <action.icon className="size-3.5" />
                {action.label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => setSel(new Set())}
          >
            <X className="size-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Content */}
      {error ? (
        <InlineError error={error} onRetry={retry} title="Couldn't load results" />
      ) : loading ? (
        <TableSkeleton rows={pageSize} cols={columns.length + (enableSelection ? 1 : 0)} />
      ) : slice.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : viewMode === "table" ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {enableSelection && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => toggleAll(!!v)}
                    />
                  </TableHead>
                )}
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn("text-xs font-medium uppercase tracking-wider text-muted-foreground", c.headerClassName)}
                  >
                    {c.header}
                  </TableHead>
                ))}
                {renderRowActions && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "group transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {enableSelection && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={sel.has(row.id)}
                        onCheckedChange={(v) => toggleSelection(row.id, !!v)}
                      />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                  {renderRowActions && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {renderRowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {viewMode === "board" ? "Board view coming soon" : "List view coming soon"}
        </div>
      )}

      {/* Pagination */}
      {enablePagination && !loading && slice.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                className="bg-background border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                defaultValue={pageSize}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              {(p - 1) * pageSize + 1}–{Math.min(p * pageSize, filtered.length)} of {filtered.length} rows
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={p <= 1}
              onClick={() => setPage(1)}
              aria-label="First"
            >
              <ChevronFirst className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={p <= 1}
              onClick={() => setPage(p - 1)}
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {getPageNumbers().map((num, idx) =>
              num === "..." ? (
                <span key={idx} className="px-2 text-muted-foreground">...</span>
              ) : (
                <Button
                  key={idx}
                  variant="outline"
                  size="icon"
                  className={cn(
                    "size-8",
                    p === num
                      ? "bg-accent border-accent-foreground/20 text-foreground"
                      : ""
                  )}
                  onClick={() => setPage(num as number)}
                >
                  {num}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={p >= pages}
              onClick={() => setPage(p + 1)}
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={p >= pages}
              onClick={() => setPage(pages)}
              aria-label="Last"
            >
              <ChevronLast className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

