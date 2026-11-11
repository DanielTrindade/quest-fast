import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Handler } from 'hono';
import { invitePath, invitePreviewText } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { originKey, type AttemptLimiter } from './attempt-limiter.ts';
import { findInvite, type InviteRecord } from './invite-lookup.ts';

type MetaInput =
  | { appUrl: string; code: string; title: string; description: string; imageVersion: string }
  | { appUrl: string; generic: true };

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

export function inviteMetaTags(input: MetaInput): string {
  const generic = 'generic' in input;
  const title = generic ? 'Quest Fast' : input.title;
  const description = generic ? 'Sua mesa de D&D 5e.' : input.description;
  const url = generic ? `${input.appUrl}/` : `${input.appUrl}${invitePath(input.code)}`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Quest Fast">',
    '<meta property="og:locale" content="pt_BR">',
  ];
  if (!generic) {
    const image = `${input.appUrl}/api/invites/${input.code}/card.png?v=${input.imageVersion}`;
    tags.push(
      `<meta property="og:image" content="${escapeHtml(image)}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">',
    );
  }
  return tags.join('\n    ');
}

export function cardVersion(record: InviteRecord): string {
  const source = [record.code, record.campaignName, record.masterName, record.masterAvatarUrl ?? ''].join('|');
  return createHash('sha256').update(source).digest('hex').slice(0, 8);
}

function injectTags(html: string, tags: string): string {
  if (/<title>[\s\S]*?<\/title>/.test(html)) return html.replace(/<title>[\s\S]*?<\/title>/, () => tags);
  return html.replace('</head>', () => `${tags}\n  </head>`);
}

export function invitePageHandler(attempts: AttemptLimiter): Handler<Context> {
  // Read once per process: a rebuild of the client needs a server restart.
  let template: string | undefined;
  return async (c) => {
    const { db, env } = c.var.deps;
    template ??= await readFile(join(env.clientDir, 'index.html'), 'utf8');
    const origin = [originKey(c)];
    const wait = attempts.retryAfter(origin);
    // A blocked origin still gets the SPA, with the generic tags and no
    // lookup; the page then shows the API's 429.
    const record = wait ? undefined : findInvite(db, c.req.param('code') ?? '');
    if (wait) {
      c.status(429);
      c.header('Retry-After', String(wait));
    } else if (!record) {
      attempts.fail(origin);
    }
    const tags = record
      ? inviteMetaTags({
          appUrl: env.appUrl,
          code: record.code,
          ...invitePreviewText(record.campaignName, record.masterName),
          imageVersion: cardVersion(record),
        })
      : inviteMetaTags({ appUrl: env.appUrl, generic: true });
    c.header('Cache-Control', 'no-cache');
    return c.html(injectTags(template, tags));
  };
}
