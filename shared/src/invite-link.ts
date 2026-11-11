export const INVITE_PATH_PREFIX = '/invite/';

const RETURN_PATH_MAX_LENGTH = 512;
const FORBIDDEN_IN_PATH = /[\u0000-\u001f\u007f\\]/;

export function invitePath(code: string): string {
  return `${INVITE_PATH_PREFIX}${code}`;
}

export function invitePreviewText(
  campaignName: string,
  masterName: string,
): { title: string; description: string } {
  return {
    title: campaignName,
    description: `${masterName} está reunindo o grupo. Tem um lugar na mesa esperando por você.`,
  };
}

export function whatsAppShareUrl(campaignName: string, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Bora jogar ${campaignName}? 🎲 ${link}`)}`;
}

/** Guards the post-login redirect against open redirects. */
export function safeReturnPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length > RETURN_PATH_MAX_LENGTH) return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  if (FORBIDDEN_IN_PATH.test(value)) return undefined;
  return value;
}

export function loginFailurePath(next: string | undefined): string {
  if (next === undefined) return '/login?error=discord';
  if (next.startsWith(INVITE_PATH_PREFIX)) {
    return `${next}${next.includes('?') ? '&' : '?'}error=discord`;
  }
  return `/login?error=discord&next=${encodeURIComponent(next)}`;
}
