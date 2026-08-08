import type { Locale } from '@stc/types';

export type SearchQuery = {
  q: string;
  type?: string[] | undefined;
  locale?: Locale | undefined;
  page: number;
  perPage: number;
};

export type SuggestQuery = {
  q: string;
  locale?: Locale | undefined;
  limit: number;
};