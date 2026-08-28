// components/dashboard/list-page.tsx
"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useCallback, useEffect } from "react";
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
  Download,
  RefreshCw,
  Filter,
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
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
  total?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageNumber?: number;
  onPageChange?: (pageNumber: number) => void;
  isLoading?: boolean;
  error?: Error | null;
  enableViewModes?: boolean;
  defaultViewMode?: ViewMode;
  enableSelection?: boolean;
  enableExport?: boolean;
  onExport?: () => void;
  enableRefresh?: boolean;
  onRefresh?: () => void;
  enableSearch?: boolean;
  enablePagination?: boolean;
  className?: string;
  renderRowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  renderHeader?: ReactNode;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  bulkActions?: BulkAction[];
  searchPlaceholder?: string;
  showSelectionCount?: boolean;
  emptyAction?: ReactNode;
};

export function ListPage<T extends { id: string }>(props: ListPageProps<T>) {
  return (
    <ErrorBoundary boundary="list_page">
      <ListPageInner {...props} />
    </ErrorBoundary>
  );
}

function ListPageInner<T extends { id: string }>({
  total,
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
  pageNumber = 1,
  onPageChange,
  onPageSizeChange,
  isLoading,
  error: externalError,
  enableViewModes = false,
  defaultViewMode = "table",
  enableSelection = true,
  enableExport = false,
  onExport,
  enableRefresh = false,
  onRefresh,
  enableSearch = true,
  enablePagination = true,
  className,
  renderRowActions,
  onRowClick,
  renderHeader,
  selectedRows: controlledSelected,
  onSelectionChange,
  bulkActions,
  showSelectionCount = true,
  emptyAction,
}: ListPageProps<T>) {
  const { loading: simLoading, error: simError, retry } = useSimulatedLoad();
  const loading = isLoading ?? simLoading;
  const error = externalError ?? simError;
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Selection State ───
  const [internalSel, setInternalSel] = useState<Set<string>>(new Set());
  const selected = controlledSelected ?? internalSel;
  const setSelected = onSelectionChange ?? setInternalSel;

  // ─── Filtering ───
  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter((row) =>
      (searchKeys ?? (Object.keys(row) as (keyof T)[]))
        .map((key) => String(row[key] ?? "").toLowerCase())
        .some((value) => value.includes(query))
    );
  }, [searchQuery, rows, searchKeys]);

  // ─── Pagination ───
  const totalItems = total ?? filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  const startIndex = (currentPageClamped - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentItems = filteredRows.slice(startIndex, endIndex);

  // ─── Selection State ───
  const allChecked = currentItems.length > 0 && currentItems.every((row) => selected.has(row.id));

  // ─── Reset page when filters change ───
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      onPageChange?.(1);
    }
  }, [searchQuery]);

  // ─── Handlers ───
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  }, [onPageChange]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setCurrentPage(1);
    onPageChange?.(1);
    onPageSizeChange?.(newSize);
    // The parent component should handle the actual page size change
  }, [onPageChange, onPageSizeChange]);

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }, [selected, setSelected]);

  const toggleAll = useCallback((checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      currentItems.forEach((row) => next.add(row.id));
    } else {
      currentItems.forEach((row) => next.delete(row.id));
    }
    setSelected(next);
  }, [selected, setSelected, currentItems]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, [setSelected]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast.success("Data refreshed");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const handleExport = useCallback(() => {
    if (!onExport) return;
    onExport();
    toast.success("Export started");
  }, [onExport]);

  // ─── Pagination numbers ───
  const getPageNumbers = useCallback(() => {
    const numbers: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) numbers.push(i);
    } else if (currentPageClamped <= 3) {
      numbers.push(1, 2, 3, "...", totalPages);
    } else if (currentPageClamped >= totalPages - 2) {
      numbers.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
    } else {
      numbers.push(1, "...", currentPageClamped, "...", totalPages);
    }
    return numbers;
  }, [totalPages, currentPageClamped]);

  // ─── Error State ───
  if (error) {
    return (
      <div className={cn("space-y-6", className)}>
        <PageHeader title={title} description={description} eyebrow={eyebrow} />
        <InlineError error={error} onRetry={retry} title="Couldn't load results" />
      </div>
    );
  }

  // ─── Loading State ───
  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <PageHeader title={title} description={description} eyebrow={eyebrow} />
        <TableSkeleton rows={pageSize} cols={columns.length + (enableSelection ? 1 : 0) + (renderRowActions ? 1 : 0)} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* ─── Page Header ─── */}
      <PageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        actions={
          <div className="flex items-center gap-2">
            {actions}
            {enableRefresh && onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            )}
            {enableExport && onExport && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                <Download className="size-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
          </div>
        }
      />

      {/* ─── Render Header (stats, charts, etc.) ─── */}
      {renderHeader}

      {/* ─── Toolbar ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-2">
          {/* Search */}
          {enableSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  onPageChange?.(1);
                }}
                placeholder={searchPlaceholder}
                className="w-48 sm:w-64 pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                    onPageChange?.(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Filters */}
          {filters}
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          {enableViewModes && (
            <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
              {[
                { value: "table", icon: TableIcon, label: "Table" },
                { value: "board", icon: LayoutGrid, label: "Board" },
                { value: "list", icon: ListIcon, label: "List" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setViewMode(value as ViewMode)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    viewMode === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Selection Count */}
          {enableSelection && showSelectionCount && selected.size > 0 && (
            <Badge variant="secondary" className="gap-1">
              {selected.size} selected
            </Badge>
          )}
        </div>
      </div>

      {/* ─── Bulk Actions Bar ─── */}
      {enableSelection && selected.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/40 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2">
          <span className="font-medium">{selected.size} selected</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {bulkActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  size="sm"
                  variant={action.variant}
                  className="gap-1.5"
                  onClick={() => {
                    action.onClick();
                    clearSelection();
                  }}
                >
                  <Icon className="size-3.5" />
                  {action.label}
                </Button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={clearSelection}
          >
            <X className="size-3.5 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* ─── Results Count ─── */}
      {!loading && filteredRows.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Showing {startIndex + 1}–{endIndex} of {totalItems} {totalItems === 1 ? "result" : "results"}
          {searchQuery && <span> filtered from {rows.length} total</span>}
        </div>
      )}

      {/* ─── Content ─── */}
      {currentItems.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : viewMode === "table" ? (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {enableSelection && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "text-xs font-medium uppercase tracking-wider text-muted-foreground",
                        col.headerClassName
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {renderRowActions && (
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "group transition-colors hover:bg-muted/30",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {enableSelection && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(checked) => toggleSelection(row.id, !!checked)}
                          aria-label={`Select row ${row.id}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn("py-2", col.className)}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                    {renderRowActions && (
                      <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {renderRowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : viewMode === "board" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentItems.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  {columns.slice(0, 2).map((col) => (
                    <div key={col.key} className="text-sm">
                      {col.cell(row)}
                    </div>
                  ))}
                </div>
                {renderRowActions && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {renderRowActions(row)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div className="space-y-2">
          {currentItems.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              {enableSelection && (
                <Checkbox
                  checked={selected.has(row.id)}
                  onCheckedChange={(checked) => toggleSelection(row.id, !!checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="flex-1 min-w-0">
                {columns.slice(0, 2).map((col) => (
                  <div key={col.key} className={cn("text-sm", col.className)}>
                    {col.cell(row)}
                  </div>
                ))}
              </div>
              {renderRowActions && (
                <div onClick={(e) => e.stopPropagation()}>
                  {renderRowActions(row)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Pagination ─── */}
      {enablePagination && !loading && currentItems.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs">Rows</span>
              <select
                className="bg-background border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={pageSize}
                aria-label="Rows per page"
                onSelect={(e)=>handlePageSizeChange(Number(e.target))}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  handlePageSizeChange(newSize);
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span>
              {startIndex + 1}–{endIndex} of {totalItems}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPageClamped <= 1}
              onClick={() => handlePageChange(1)}
              aria-label="First page"
            >
              <ChevronFirst className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPageClamped <= 1}
              onClick={() => handlePageChange(currentPageClamped - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {getPageNumbers().map((num, idx) =>
              num === "..." ? (
                <span key={idx} className="px-2 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={idx}
                  variant="outline"
                  size="icon"
                  className={cn(
                    "size-8",
                    currentPageClamped === num
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : ""
                  )}
                  onClick={() => handlePageChange(num as number)}
                >
                  {num}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPageClamped >= totalPages}
              onClick={() => handlePageChange(currentPageClamped + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPageClamped >= totalPages}
              onClick={() => handlePageChange(totalPages)}
              aria-label="Last page"
            >
              <ChevronLast className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}