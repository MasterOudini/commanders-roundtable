// `Mintstrosity` — "When this creature dies, create a Food token." The
// dies-Food (Jewel-Eyed Cobra's shape on a Horror). D225.

import { MINTSTROSITY } from '../../../data/fixtures/engineCards';
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
  MINTSTROSITY,
  'When this creature dies, create a Food token. ' +
    '(It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FOOD = tokenRef('Food|/||Artifact|');

export const MINTSTROSITY_SCRIPT: CardScript = {
  oracleId: MINTSTROSITY.oracleId,
  name: MINTSTROSITY.name,
  triggers: [
    {
      abilityId: 'dies-food',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Mintstrosity — create a Food token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FOOD.oracleId,
          printingId: FOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
