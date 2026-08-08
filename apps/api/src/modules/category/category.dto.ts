import { toIsoDate } from '@stc/utils';

import { categoryPath } from './category.events.js';
import type { CategoryRecord, CategoryTreeNode } from './category.types.js';

/**
 * Category DTOs.
 *
 * `path` is derived from type + slug in ONE place, so a blog category never
 * accidentally renders a /news/ URL. `breadcrumb` ships root-first, ready for
 * BreadcrumbList JSON-LD without the frontend re-walking the tree.
 */

export type CategoryCrumbDto = { id: string; name: string; slug: string; path: string };

export type CategoryDto = {
  id: string;
  slug: string;
  path: string;
  name: string;
  type: string;
  parentId: string | null;
  description: string | null;
  order: number;
  entryCount: number;
  breadcrumb: CategoryCrumbDto[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CategoryTreeDto = CategoryCrumbDto & {
  type: string;
  order: number;
  children: CategoryTreeDto[];
};

export function toCategoryDto(record: CategoryRecord, ancestors: CategoryTreeNode[]): CategoryDto {
  return {
    id: record.id,
    slug: record.slug,
    path: categoryPath(record.type, record.slug),
    name: record.name,
    type: record.type,
    parentId: record.parentId,
    description: record.description,
    order: record.order,
    entryCount: record.entryCount,
    breadcrumb: ancestors.map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      path: categoryPath(node.type, node.slug),
    })),
    createdAt: toIsoDate(record.createdAt) ?? '',
    updatedAt: toIsoDate(record.updatedAt) ?? '',
    deletedAt: toIsoDate(record.deletedAt),
  };
}

/**
 * Rebuilds the nested tree from the CTE`s flat, depth-ordered rows.
 *
 * Single pass with an index map - the naive version filters the whole array
 * once per node, which is O(n^2) and noticeable by ~200 categories.
 */
export function toCategoryTreeDto(nodes: CategoryTreeNode[]): CategoryTreeDto[] {
  const byId = new Map<string, CategoryTreeDto>();
  const roots: CategoryTreeDto[] = [];

  for (const node of nodes) {
    byId.set(node.id, {
      id: node.id,
      name: node.name,
      slug: node.slug,
      path: categoryPath(node.type, node.slug),
      type: node.type,
      order: node.order,
      children: [],
    });
  }

  for (const node of nodes) {
    const dto = byId.get(node.id)!;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(dto);
    else roots.push(dto);
  }

  return roots;
}

export function toCategorySnapshot(record: CategoryRecord): Record<string, unknown> {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    type: record.type,
    parentId: record.parentId,
    description: record.description,
    order: record.order,
    status: 'PUBLISHED',
  };
}