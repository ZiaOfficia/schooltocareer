import type { SortDirection } from '@stc/types';

export type CategoryRecord = {
  id: string;
  siteId: string;
  slug: string;
  name: string;
  type: string;
  parentId: string | null;
  description: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  entryCount: number;
};

/** A node plus its position in the tree. Produced by the recursive CTE. */
export type CategoryTreeNode = {
  id: string;
  slug: string;
  name: string;
  type: string;
  parentId: string | null;
  order: number;
  depth: number;
};

export type CategoryFilters = {
  type?: string | undefined;
  parentId?: string | undefined;
  rootsOnly?: boolean;
  search?: string | undefined;
  includeDeleted?: boolean;
};

export type CategoryListParams = CategoryFilters & {
  siteId: string;
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type CategoryWriteData = {
  name: string;
  type: string;
  parentId: string | null;
  description: string | null;
  order: number;
};