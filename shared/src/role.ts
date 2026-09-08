/**
 * Roles within a campaign. Real authorization always happens on the server,
 * derived from `CampaignMember`; these types only name what both sides
 * exchange.
 */
export const ROLES = ['master', 'player'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
