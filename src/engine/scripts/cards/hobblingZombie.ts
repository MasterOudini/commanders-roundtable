// `Hobbling Zombie` — "When this creature dies, create a 2/2 black Zombie
// creature token with decayed." The dies-token on the DECAYED printing the
// pool already holds (D174): the token's own restrictions are the token's
// text, disclosed on the token — creating it is not half-execution (the
// Blood precedent). M6.4w, D179.

import { HOBBLING_ZOMBIE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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
  HOBBLING_ZOMBIE,
  'Deathtouch\nWhen this creature dies, create a 2/2 black Zombie creature token with decayed. ' +
    "(It can't block. When it attacks, sacrifice it at end of combat.)",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const DECAYED_ZOMBIE = tokenRef('Zombie|2/2|B|Creature|decayed');

export const HOBBLING_ZOMBIE_SCRIPT: CardScript = {
  oracleId: HOBBLING_ZOMBIE.oracleId,
  name: HOBBLING_ZOMBIE.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Hobbling Zombie — create a decayed 2/2 Zombie',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DECAYED_ZOMBIE.oracleId,
          printingId: DECAYED_ZOMBIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
