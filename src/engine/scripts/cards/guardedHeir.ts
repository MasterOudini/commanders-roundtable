// `Guarded Heir` — "When this creature enters, create two 3/3 white Knight
// creature tokens." Two DISTINCT ids (D164); line 1 is Lifelink (Tier 2).
// M6.4v, D178.

import { GUARDED_HEIR } from '../../../data/fixtures/engineCards';
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
  GUARDED_HEIR,
  'Lifelink (Damage dealt by this creature also causes you to gain that much life.)\nWhen this creature enters, create two 3/3 white Knight creature tokens.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const KNIGHT = tokenRef('Knight|3/3|W|Creature|');

export const GUARDED_HEIR_SCRIPT: CardScript = {
  oracleId: GUARDED_HEIR.oracleId,
  name: GUARDED_HEIR.name,
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
      label: () => 'Guarded Heir — create two 3/3 Knights',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: KNIGHT.oracleId,
          printingId: KNIGHT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
