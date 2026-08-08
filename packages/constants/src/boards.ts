import type { BoardType } from '@stc/types';

/**
 * Canonical board seed data. This is the source of truth for `db:seed` and for
 * the board slugs referenced anywhere in code — never write `'cbse'` as a bare
 * string literal.
 *
 * Editorial fields (description, logo, popularityScore) are managed in the
 * admin after seeding; only identity lives here.
 */

export type BoardSeed = {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly type: BoardType;
  /** State code from STATES; null for central/international boards. */
  readonly stateCode: string | null;
  readonly officialWebsite: string;
  readonly establishedYear?: number;
};

export const BOARDS = {
  CBSE: 'cbse',
  CISCE: 'cisce',
  NIOS: 'nios',
  UP: 'up-board',
  MAHARASHTRA: 'maharashtra-board',
  BIHAR: 'bihar-board',
  RAJASTHAN: 'rajasthan-board',
  MP: 'mp-board',
  WEST_BENGAL: 'wb-board',
  TAMIL_NADU: 'tn-board',
  KARNATAKA: 'karnataka-board',
  GUJARAT: 'gujarat-board',
  KERALA: 'kerala-board',
  TELANGANA: 'telangana-board',
  ANDHRA_PRADESH: 'ap-board',
  PUNJAB: 'punjab-board',
  HARYANA: 'haryana-board',
  ODISHA: 'odisha-board',
  ASSAM: 'assam-board',
  JHARKHAND: 'jharkhand-board',
} as const;

export type BoardSlug = (typeof BOARDS)[keyof typeof BOARDS];

export const BOARD_SEEDS: readonly BoardSeed[] = [
  {
    slug: BOARDS.CBSE,
    name: 'Central Board of Secondary Education',
    shortName: 'CBSE',
    type: 'CENTRAL',
    stateCode: null,
    officialWebsite: 'https://www.cbse.gov.in',
    establishedYear: 1962,
  },
  {
    slug: BOARDS.CISCE,
    name: 'Council for the Indian School Certificate Examinations',
    shortName: 'CISCE',
    type: 'CENTRAL',
    stateCode: null,
    officialWebsite: 'https://www.cisce.org',
    establishedYear: 1958,
  },
  {
    slug: BOARDS.NIOS,
    name: 'National Institute of Open Schooling',
    shortName: 'NIOS',
    type: 'OPEN_SCHOOLING',
    stateCode: null,
    officialWebsite: 'https://www.nios.ac.in',
    establishedYear: 1989,
  },
  {
    slug: BOARDS.UP,
    name: 'Uttar Pradesh Madhyamik Shiksha Parishad',
    shortName: 'UP Board',
    type: 'STATE',
    stateCode: 'UP',
    officialWebsite: 'https://upmsp.edu.in',
    establishedYear: 1921,
  },
  {
    slug: BOARDS.MAHARASHTRA,
    name: 'Maharashtra State Board of Secondary and Higher Secondary Education',
    shortName: 'MSBSHSE',
    type: 'STATE',
    stateCode: 'MH',
    officialWebsite: 'https://mahahsscboard.in',
    establishedYear: 1965,
  },
  {
    slug: BOARDS.BIHAR,
    name: 'Bihar School Examination Board',
    shortName: 'BSEB',
    type: 'STATE',
    stateCode: 'BR',
    officialWebsite: 'https://biharboardonline.bihar.gov.in',
    establishedYear: 1952,
  },
  {
    slug: BOARDS.RAJASTHAN,
    name: 'Board of Secondary Education Rajasthan',
    shortName: 'RBSE',
    type: 'STATE',
    stateCode: 'RJ',
    officialWebsite: 'https://rajeduboard.rajasthan.gov.in',
    establishedYear: 1957,
  },
  {
    slug: BOARDS.MP,
    name: 'Madhya Pradesh Board of Secondary Education',
    shortName: 'MPBSE',
    type: 'STATE',
    stateCode: 'MP',
    officialWebsite: 'https://mpbse.nic.in',
    establishedYear: 1965,
  },
  {
    slug: BOARDS.WEST_BENGAL,
    name: 'West Bengal Board of Secondary Education',
    shortName: 'WBBSE',
    type: 'STATE',
    stateCode: 'WB',
    officialWebsite: 'https://wbbse.wb.gov.in',
    establishedYear: 1951,
  },
  {
    slug: BOARDS.TAMIL_NADU,
    name: 'Tamil Nadu State Board of School Examination',
    shortName: 'TN Board',
    type: 'STATE',
    stateCode: 'TN',
    officialWebsite: 'https://dge.tn.gov.in',
  },
  {
    slug: BOARDS.KARNATAKA,
    name: 'Karnataka School Examination and Assessment Board',
    shortName: 'KSEAB',
    type: 'STATE',
    stateCode: 'KA',
    officialWebsite: 'https://kseab.karnataka.gov.in',
  },
  {
    slug: BOARDS.GUJARAT,
    name: 'Gujarat Secondary and Higher Secondary Education Board',
    shortName: 'GSEB',
    type: 'STATE',
    stateCode: 'GJ',
    officialWebsite: 'https://gseb.org',
    establishedYear: 1960,
  },
  {
    slug: BOARDS.KERALA,
    name: 'Kerala Board of Public Examinations',
    shortName: 'Kerala Board',
    type: 'STATE',
    stateCode: 'KL',
    officialWebsite: 'https://keralapareekshabhavan.in',
  },
  {
    slug: BOARDS.TELANGANA,
    name: 'Telangana Board of Secondary Education',
    shortName: 'TS BSE',
    type: 'STATE',
    stateCode: 'TG',
    officialWebsite: 'https://bse.telangana.gov.in',
  },
  {
    slug: BOARDS.ANDHRA_PRADESH,
    name: 'Board of Secondary Education Andhra Pradesh',
    shortName: 'BSEAP',
    type: 'STATE',
    stateCode: 'AP',
    officialWebsite: 'https://bse.ap.gov.in',
  },
  {
    slug: BOARDS.PUNJAB,
    name: 'Punjab School Education Board',
    shortName: 'PSEB',
    type: 'STATE',
    stateCode: 'PB',
    officialWebsite: 'https://www.pseb.ac.in',
    establishedYear: 1969,
  },
  {
    slug: BOARDS.HARYANA,
    name: 'Board of School Education Haryana',
    shortName: 'BSEH',
    type: 'STATE',
    stateCode: 'HR',
    officialWebsite: 'https://bseh.org.in',
    establishedYear: 1969,
  },
  {
    slug: BOARDS.ODISHA,
    name: 'Board of Secondary Education Odisha',
    shortName: 'BSE Odisha',
    type: 'STATE',
    stateCode: 'OD',
    officialWebsite: 'https://bseodisha.ac.in',
  },
  {
    slug: BOARDS.ASSAM,
    name: 'Assam State School Education Board',
    shortName: 'ASSEB',
    type: 'STATE',
    stateCode: 'AS',
    officialWebsite: 'https://sebaonline.org',
  },
  {
    slug: BOARDS.JHARKHAND,
    name: 'Jharkhand Academic Council',
    shortName: 'JAC',
    type: 'STATE',
    stateCode: 'JH',
    officialWebsite: 'https://jac.jharkhand.gov.in',
  },
];

/** Indian states/UTs. `code` matches State.code in the schema. */
export const STATES: readonly { code: string; name: string; slug: string; region: string }[] = [
  { code: 'AP', name: 'Andhra Pradesh', slug: 'andhra-pradesh', region: 'South' },
  { code: 'AS', name: 'Assam', slug: 'assam', region: 'North East' },
  { code: 'BR', name: 'Bihar', slug: 'bihar', region: 'East' },
  { code: 'CG', name: 'Chhattisgarh', slug: 'chhattisgarh', region: 'Central' },
  { code: 'DL', name: 'Delhi', slug: 'delhi', region: 'North' },
  { code: 'GA', name: 'Goa', slug: 'goa', region: 'West' },
  { code: 'GJ', name: 'Gujarat', slug: 'gujarat', region: 'West' },
  { code: 'HR', name: 'Haryana', slug: 'haryana', region: 'North' },
  { code: 'HP', name: 'Himachal Pradesh', slug: 'himachal-pradesh', region: 'North' },
  { code: 'JH', name: 'Jharkhand', slug: 'jharkhand', region: 'East' },
  { code: 'JK', name: 'Jammu and Kashmir', slug: 'jammu-and-kashmir', region: 'North' },
  { code: 'KA', name: 'Karnataka', slug: 'karnataka', region: 'South' },
  { code: 'KL', name: 'Kerala', slug: 'kerala', region: 'South' },
  { code: 'MP', name: 'Madhya Pradesh', slug: 'madhya-pradesh', region: 'Central' },
  { code: 'MH', name: 'Maharashtra', slug: 'maharashtra', region: 'West' },
  { code: 'MN', name: 'Manipur', slug: 'manipur', region: 'North East' },
  { code: 'ML', name: 'Meghalaya', slug: 'meghalaya', region: 'North East' },
  { code: 'MZ', name: 'Mizoram', slug: 'mizoram', region: 'North East' },
  { code: 'NL', name: 'Nagaland', slug: 'nagaland', region: 'North East' },
  { code: 'OD', name: 'Odisha', slug: 'odisha', region: 'East' },
  { code: 'PB', name: 'Punjab', slug: 'punjab', region: 'North' },
  { code: 'RJ', name: 'Rajasthan', slug: 'rajasthan', region: 'North' },
  { code: 'SK', name: 'Sikkim', slug: 'sikkim', region: 'North East' },
  { code: 'TN', name: 'Tamil Nadu', slug: 'tamil-nadu', region: 'South' },
  { code: 'TG', name: 'Telangana', slug: 'telangana', region: 'South' },
  { code: 'TR', name: 'Tripura', slug: 'tripura', region: 'North East' },
  { code: 'UP', name: 'Uttar Pradesh', slug: 'uttar-pradesh', region: 'North' },
  { code: 'UK', name: 'Uttarakhand', slug: 'uttarakhand', region: 'North' },
  { code: 'WB', name: 'West Bengal', slug: 'west-bengal', region: 'East' },
  { code: 'AR', name: 'Arunachal Pradesh', slug: 'arunachal-pradesh', region: 'North East' },
  { code: 'CH', name: 'Chandigarh', slug: 'chandigarh', region: 'North' },
  { code: 'PY', name: 'Puducherry', slug: 'puducherry', region: 'South' },
];
