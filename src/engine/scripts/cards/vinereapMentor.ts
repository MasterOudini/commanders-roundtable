// `Vinereap Mentor` — the enters-OR-dies Food pair (Grave Titan's shape,
// D178): ONE printed line, TWO defs, the dies arm looking back (CR 603.10a).
// D266.

import { VINEREAP_MENTOR } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TEXT = printed(
  VINEREAP_MENTOR,
  'When this creature enters or dies, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
);

const FOOD = tokenRef('Food|/||Artifact|');

export const VINEREAP_MENTOR_SCRIPT: CardScript = {
  oracleId: VINEREAP_MENTOR.oracleId,
  name: VINEREAP_MENTOR.name,
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
      label: () => 'Vinereap Mentor — create a Food token',
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
      label: () => 'Vinereap Mentor — create a Food token',
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
