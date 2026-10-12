export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export function paginationWindow(totalItems: number, pageSize: number, requestedPage: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const currentPage = Math.min(totalPages, Math.max(1, Math.floor(requestedPage)));
  const offset = (currentPage - 1) * size;
  return { currentPage, totalPages, offset, startItem: totalItems === 0 ? 0 : offset + 1, endItem: Math.min(offset + size, totalItems) };
}

export function paginateItems<T>(items: readonly T[], pageSize: number, page: number) {
  const window = paginationWindow(items.length, pageSize, page);
  return { ...window, items: items.slice(window.offset, window.offset + pageSize) };
}