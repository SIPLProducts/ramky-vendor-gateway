import { describe, expect, test } from 'bun:test';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems, paginationWindow } from './pagination';

describe('record pagination', () => {
  test('defaults to ten records and supports the approved page sizes', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(10);
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 30, 50]);
  });
  test('uses ten records on the first page without changing the full result', () => {
    const records = Array.from({ length: 23 }, (_, id) => ({ id }));
    expect(paginateItems(records, DEFAULT_PAGE_SIZE, 1).items.map(row => row.id)).toEqual([0,1,2,3,4,5,6,7,8,9]);
    expect(records.length).toBe(23);
  });
  test('returns a partial final page and clamps after records shrink', () => {
    expect(paginateItems([1,2,3,4,5,6,7,8,9,10,11], 10, 4)).toEqual({ currentPage: 2, totalPages: 2, offset: 10, startItem: 11, endItem: 11, items: [11] });
    expect(paginateItems([1,2], 10, 4).items).toEqual([1,2]);
  });
  test('empty results have a valid page and a zero range', () => {
    expect(paginationWindow(0,10,5)).toEqual({ currentPage: 1, totalPages: 1, offset: 0, startItem: 0, endItem: 0 });
  });
  test('page-size changes produce the correct number of records', () => {
    const records = Array.from({ length: 65 }, (_, id) => id);
    for (const size of [10,20,30,50]) {
      expect(paginateItems(records,size,1).items.length).toBe(size);
      expect(paginateItems(records,size,1).startItem).toBe(1);
    }
  });
});