// `Valorous Steed` — vigilance (with reminder) plus the ETB Knight on the
// already-pinned 2/2 vigilance token. The keyword line never counts, so the
// def's text is `split[1]`. D265.

import { VALOROUS_STEED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  VALOROUS_STEED,
  "Vigilance (Attacking doesn't cause this creature to tap.)\nWhen this creature enters, create a 2/2 white Knight creature token with vigilance.",
);
const TEXT = PRINTED.split('\n')[1] as string;

const KNIGHT = tokenRef('Knight|2/2|W|Creature|vigilance');

export const VALOROUS_STEED_SCRIPT: CardScript = {
  oracleId: VALOROUS_STEED.oracleId,
  name: VALOROUS_STEED.name,
  triggers: [
    {
      abilityId: 'etb-knight',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Valorous Steed — create a 2/2 Knight with vigilance',
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
