// `Grave Titan` — "Whenever this creature enters or attacks, create two 2/2
// black Zombie creature tokens." ONE printed line, TWO defs (Ashen Rider's
// enters-or-dies rule on the ATTACK side): the entry via `CardsMoved`, the
// attack via `AttackersDeclared`, both paying two DISTINCT Zombies through
// D164's allocator. Line 1 is Deathtouch (Tier 2). M6.4v, D178.

import { GRAVE_TITAN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(
  GRAVE_TITAN,
  'Deathtouch\nWhenever this creature enters or attacks, create two 2/2 black Zombie creature tokens.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ZOMBIE = tokenRef('Zombie|2/2|B|Creature|');

function makeZombies(ctx: ScriptCtx, controller: PlayerId): readonly EventBody[] {
  return [0, 1].map(() => ({
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: ZOMBIE.oracleId,
    printingId: ZOMBIE.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  }));
}

export const GRAVE_TITAN_SCRIPT: CardScript = {
  oracleId: GRAVE_TITAN.oracleId,
  name: GRAVE_TITAN.name,
  triggers: [
    {
      abilityId: 'enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Grave Titan — create two 2/2 Zombies',
      resolve: (ctx, _self, obj): readonly EventBody[] => makeZombies(ctx, obj.controller),
    },
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Grave Titan — create two 2/2 Zombies',
      resolve: (ctx, _self, obj): readonly EventBody[] => makeZombies(ctx, obj.controller),
    },
  ],
};
