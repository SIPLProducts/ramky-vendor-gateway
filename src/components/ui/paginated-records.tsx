import { useEffect, useState, type ReactNode } from 'react';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination';

interface PaginatedRecordsProps<T> {
  items: readonly T[] | null | undefined;
  children: (items: T[]) => ReactNode;
  resetKey?: string;
}

/** Paginate only record rendering; callers keep full arrays for actions and exports. */
export function PaginatedRecords<T>({ items, children, resetKey = '' }: PaginatedRecordsProps<T>) {
  const records = items ?? [];
  const identity = records.map((record, index) => {
    if (record && typeof record === 'object') {
      const row = record as Record<string, unknown>;
      return String(row.id ?? row.vendorId ?? row.vendor_id ?? row.code ?? index);
    }
    return String(record);
  }).join('|');
  const key = `${resetKey}:${identity}`;
  const [state, setState] = useState({ key, page: 1, size: DEFAULT_PAGE_SIZE });
  const page = key === state.key ? state.page : 1;
  const window = paginateItems(records, state.size, page);
  useEffect(() => {
    setState(previous => previous.key === key && previous.page === window.currentPage
      ? previous : { ...previous, key, page: window.currentPage });
  }, [key, window.currentPage]);
  return (
    <>
      {children(window.items)}
      <DataTablePagination
        currentPage={window.currentPage}
        totalPages={window.totalPages}
        pageSize={state.size}
        totalItems={records.length}
        onPageChange={page => setState(previous => ({ ...previous, key, page }))}
        onPageSizeChange={size => setState({ key, page: 1, size })}
      />
    </>
  );
}