// `Maalfeld Twins` — "When this creature dies, create two 2/2 black Zombie
// creature tokens." The dies pair with distinct ids on the Zombie pin the
// pool already holds. M6.4ac, D185.

import { MAALFELD_TWINS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  MAALFELD_TWINS,
  'When this creature dies, create two 2/2 black Zombie creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ZOMBIE = tokenRef('Zombie|2/2|B|Creature|');

export const MAALFELD_TWINS_SCRIPT: CardScript = {
  oracleId: MAALFELD_TWINS.oracleId,
  name: MAALFELD_TWINS.name,
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
      label: () => 'Maalfeld Twins — create two 2/2 Zombies',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: ZOMBIE.oracleId,
          printingId: ZOMBIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
