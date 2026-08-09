// `Forecasting Fortune Teller` — "When this creature enters, create a Clue
// token." The first CLUE a shipped def creates — its "{2}, Sacrifice this
// token: Draw a card" is the token's own text, tier3-disclosed on it (the
// Blood precedent, D164). M6.4s, D175.

import { FORECASTING_FORTUNE_TELLER } from '../../../data/fixtures/engineCards';
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
  FORECASTING_FORTUNE_TELLER,
  'When this creature enters, create a Clue token. ' +
    '(It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const FORECASTING_FORTUNE_TELLER_SCRIPT: CardScript = {
  oracleId: FORECASTING_FORTUNE_TELLER.oracleId,
  name: FORECASTING_FORTUNE_TELLER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Forecasting Fortune Teller — create a Clue token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CLUE.oracleId,
          printingId: CLUE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
