import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { initials } from '@quest-fast/shared';

const WIDTH = 1200;
const HEIGHT = 630;
const AVATAR_CDN = 'https://cdn.discordapp.com/';
const AVATAR_LIMIT_BYTES = 1024 * 1024;
const AVATAR_TIMEOUT_MS = 2000;
const SURFACE = '#16181d';
const ACCENT = '#3b6fe0';
const HEX_POINTS = '156,0 312,78 312,234 156,312 0,234 0,78';

type Node = { type: string; props: Record<string, unknown> };
type CardInput = { campaignName: string; masterName: string; avatar: Uint8Array | undefined };
type Fonts = Parameters<typeof satori>[1]['fonts'];

const FONT_DIR = join(import.meta.dirname, '../../assets/fonts');

let fonts: Promise<Fonts> | undefined;

function loadFonts(): Promise<Fonts> {
  if (!fonts) {
    fonts = Promise.all([
      readFile(join(FONT_DIR, 'space-grotesk-latin-700-normal.woff')),
      readFile(join(FONT_DIR, 'geist-latin-400-normal.woff')),
      readFile(join(FONT_DIR, 'geist-latin-600-normal.woff')),
    ]).then(([display, regular, semibold]): Fonts => [
      { name: 'Space Grotesk', data: display, weight: 700, style: 'normal' },
      { name: 'Geist', data: regular, weight: 400, style: 'normal' },
      { name: 'Geist', data: semibold, weight: 600, style: 'normal' },
    ]);
    fonts.catch(() => {
      fonts = undefined;
    });
  }
  return fonts;
}

function el(type: string, props: Record<string, unknown>): Node {
  return { type, props };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function imageMime(bytes: Uint8Array): string | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  return undefined;
}

function hexagon(): Node {
  return el('svg', {
    width: 312,
    height: 312,
    viewBox: '0 0 312 312',
    style: { position: 'absolute', left: 0, top: 0 },
    children: [
      el('defs', {
        children: el('linearGradient', {
          id: 'hex',
          x1: '0.33',
          y1: '0',
          x2: '0.67',
          y2: '1',
          children: [
            el('stop', { offset: '0', 'stop-color': '#22252d' }),
            el('stop', { offset: '1', 'stop-color': '#1d2026' }),
          ],
        }),
      }),
      el('polygon', { points: HEX_POINTS, fill: 'url(#hex)' }),
      el('circle', { cx: 156, cy: 156, r: 102, fill: ACCENT }),
      el('circle', { cx: 156, cy: 156, r: 97.2, fill: SURFACE }),
    ],
  });
}

function avatarNode(name: string, avatar: Uint8Array | undefined): Node {
  const box = { position: 'absolute', left: 66, top: 66, width: 180, height: 180, borderRadius: '50%' };
  const mime = avatar && imageMime(avatar);
  if (avatar && mime) {
    const src = `data:${mime};base64,${Buffer.from(avatar).toString('base64')}`;
    return el('img', { src, width: 180, height: 180, style: { ...box, objectFit: 'cover' } });
  }
  return el('div', {
    style: {
      ...box,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'linear-gradient(135deg, #5865f2, #3b6fe0)',
      color: '#ffffff',
      fontFamily: 'Space Grotesk',
      fontWeight: 700,
      fontSize: 72,
    },
    children: initials(name),
  });
}

function cardTree(input: CardInput): Node {
  return el('div', {
    style: {
      display: 'flex',
      position: 'relative',
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: SURFACE,
      color: '#edeff3',
      fontFamily: 'Geist',
      overflow: 'hidden',
    },
    children: [
      el('div', {
        style: {
          position: 'absolute',
          right: -96,
          top: -168,
          width: 696,
          height: 696,
          backgroundImage: 'radial-gradient(circle at center, rgba(59,111,224,0.33), rgba(59,111,224,0) 65%)',
        },
      }),
      el('div', {
        style: { position: 'absolute', left: 828, top: 159, width: 312, height: 312, display: 'flex' },
        children: [hexagon(), avatarNode(input.masterName, input.avatar)],
      }),
      el('div', {
        style: {
          position: 'absolute',
          left: 72,
          top: 72,
          width: 672,
          height: 486,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
        children: [
          el('div', {
            style: { display: 'flex', flexDirection: 'column', gap: 36 },
            children: [
              el('div', {
                style: {
                  fontSize: 25,
                  fontWeight: 600,
                  color: '#7aa5f5',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                },
                children: 'Convite para a mesa',
              }),
              el('div', {
                style: {
                  display: 'block',
                  fontFamily: 'Space Grotesk',
                  fontWeight: 700,
                  fontSize: 84,
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                  lineClamp: 3,
                  wordBreak: 'break-word',
                },
                children: input.campaignName,
              }),
            ],
          }),
          el('div', {
            style: { display: 'flex', flexDirection: 'column', gap: 24 },
            children: [
              el('div', {
                style: { display: 'flex', fontSize: 34, color: '#8e939e' },
                children: [
                  el('span', {
                    style: {
                      color: '#edeff3',
                      fontWeight: 600,
                      maxWidth: 360,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    },
                    children: input.masterName,
                  }),
                  el('span', { style: { whiteSpace: 'pre' }, children: ' está reunindo o grupo' }),
                ],
              }),
              el('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: 'Space Grotesk',
                  fontWeight: 700,
                  fontSize: 29,
                  color: '#8e939e',
                },
                children: [
                  el('svg', {
                    width: 29,
                    height: 29,
                    viewBox: '0 0 100 100',
                    children: el('polygon', { points: '50,0 100,25 100,75 50,100 0,75 0,25', fill: ACCENT }),
                  }),
                  el('span', { children: 'Quest Fast' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function renderPng(input: CardInput): Promise<Uint8Array> {
  const svg = await satori(cardTree(input) as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: await loadFonts(),
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
}

export async function renderInviteCard(input: CardInput): Promise<Uint8Array> {
  if (!input.avatar) return renderPng(input);
  try {
    return await renderPng(input);
  } catch {
    return renderPng({ ...input, avatar: undefined });
  }
}

async function readLimited(response: Response): Promise<Uint8Array | undefined> {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > AVATAR_LIMIT_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchAvatar(
  url: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array | undefined> {
  if (!url?.startsWith(AVATAR_CDN)) return undefined;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS), redirect: 'error' });
    if (!response.ok) return undefined;
    const type = response.headers.get('content-type')?.split(';')[0].trim();
    if (type !== 'image/png' && type !== 'image/jpeg') return undefined;
    const declared = Number(response.headers.get('content-length'));
    if (declared > AVATAR_LIMIT_BYTES) return undefined;
    const bytes = await readLimited(response);
    return bytes && imageMime(bytes) ? bytes : undefined;
  } catch {
    return undefined;
  }
}

const CARD_CACHE_LIMIT = 200;

type CardSource = { campaignName: string; masterName: string; masterAvatarUrl: string | null };

export function createCardProvider(
  deps: {
    fetchAvatar?: typeof fetchAvatar;
    renderCard?: typeof renderInviteCard;
  } = {},
) {
  const download = deps.fetchAvatar ?? fetchAvatar;
  const render = deps.renderCard ?? renderInviteCard;
  const cache = new Map<string, Uint8Array>();
  const rendering = new Map<string, Promise<Uint8Array>>();

  return {
    async get(version: string, source: CardSource): Promise<Uint8Array> {
      const cached = cache.get(version);
      if (cached) return cached;

      let pending = rendering.get(version);
      if (!pending) {
        pending = (async () =>
          render({
            campaignName: source.campaignName,
            masterName: source.masterName,
            avatar: await download(source.masterAvatarUrl),
          }))().finally(() => rendering.delete(version));
        rendering.set(version, pending);
      }

      const png = await pending;
      if (!cache.has(version)) {
        if (cache.size >= CARD_CACHE_LIMIT) cache.delete(cache.keys().next().value!);
        cache.set(version, png);
      }
      return png;
    },
  };
}
