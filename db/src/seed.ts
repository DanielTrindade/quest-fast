import { randomUUID } from 'node:crypto';
import { generateInviteCode } from '@quest-fast/shared';
import { campaignMembers, campaigns, createDb, sessions, users } from './index.ts';

/**
 * Sample campaign for development and visual review. It also creates a fixed
 * session, so the interface can be opened without going through Discord.
 * Must not be run in production.
 *
 *   npm run db:seed
 *
 * The session printed at the end works as the `qf_session` cookie.
 */

const db = createDb();

const master = { id: randomUUID(), discordId: 'seed-master', name: 'Lia Martins', avatarUrl: null };
const players = [
  { id: randomUUID(), discordId: 'seed-rafael', name: 'Rafael Costa', avatarUrl: null },
  { id: randomUUID(), discordId: 'seed-ana', name: 'Ana Beatriz', avatarUrl: null },
  { id: randomUUID(), discordId: 'seed-pedro', name: 'Pedro Alves', avatarUrl: null },
];

for (const user of [master, ...players]) {
  db.insert(users).values(user).onConflictDoNothing().run();
}

// Sample content stays in Portuguese: it is what the table reads.
const campaign = {
  id: randomUUID(),
  name: 'Ecos de Phandalin',
  description: 'A próxima aventura começa com a mesa reunida.',
  inviteCode: generateInviteCode(),
};
db.insert(campaigns).values(campaign).run();

db.insert(campaignMembers)
  .values({ id: randomUUID(), campaignId: campaign.id, userId: master.id, role: 'master' })
  .run();
for (const player of players) {
  db.insert(campaignMembers)
    .values({ id: randomUUID(), campaignId: campaign.id, userId: player.id, role: 'player' })
    .run();
}

const session = randomUUID();
db.insert(sessions)
  .values({
    id: session,
    userId: master.id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  .run();

console.log(`Campaign "${campaign.name}" created with invite code ${campaign.inviteCode}.`);
console.log(`Master session (qf_session cookie): ${session}`);
