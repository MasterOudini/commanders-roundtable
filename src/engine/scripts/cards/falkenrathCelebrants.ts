// `Falkenrath Celebrants` — "Menace\nWhen this creature enters, create two
// Blood tokens." Two DISTINCT ids on D164's Blood pin. M6.4r, D174.

import { FALKENRATH_CELEBRANTS } from '../../../data/fixtures/engineCards';
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
  FALKENRATH_CELEBRANTS,
  "Menace (This creature can't be blocked except by two or more creatures.)\n" +
    'When this creature enters, create two Blood tokens. ' +
    '(They\'re artifacts with "{1}, {T}, Discard a card, Sacrifice this token: Draw a card.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BLOOD = tokenRef('Blood|/||Artifact|');

export const FALKENRATH_CELEBRANTS_SCRIPT: CardScript = {
  oracleId: FALKENRATH_CELEBRANTS.oracleId,
  name: FALKENRATH_CELEBRANTS.name,
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
      label: () => 'Falkenrath Celebrants — create two Blood tokens',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BLOOD.oracleId,
          printingId: BLOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
