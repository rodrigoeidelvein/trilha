/**
 * The words the UI puts on domain values.
 *
 * They are not in `src/domain`, because the domain is data and these are copy;
 * they are not in a feature, because the Skills board, the Map's legend and
 * the log form all want the same words.
 */

import type { Role, Status } from './domain/types';

export const STATUS_LABELS: Record<Status, string> = {
  want: 'Want',
  working: 'Working',
  got: 'Got it',
};

export const ROLE_LABELS: Record<Role, string> = {
  base: 'Base',
  flyer: 'Flyer',
  spotter: 'Spotter',
};
