// `Knight of the New Coalition` — "When this creature enters, create a 2/2
// white and blue Knight creature token with vigilance." The two-colour
// vigilance Knight joins the pool (its keyword is its identity, D131).
// M6.4ab, D184.

import { KNIGHT_OF_THE_NEW_COALITION } from '../../../data/fixtures/engineCards';
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
  KNIGHT_OF_THE_NEW_COALITION,
  'Vigilance\nWhen this creature enters, create a 2/2 white and blue Knight creature token with vigilance.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const KNIGHT = tokenRef('Knight|2/2|UW|Creature|vigilance');

export const KNIGHT_OF_THE_NEW_COALITION_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_THE_NEW_COALITION.oracleId,
  name: KNIGHT_OF_THE_NEW_COALITION.name,
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
      label: () => 'Knight of the New Coalition — create a 2/2 Knight',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: KNIGHT.oracleId,
          printingId: KNIGHT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
