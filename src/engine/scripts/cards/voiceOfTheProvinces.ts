// `Voice of the Provinces` — flying plus the untargeted ETB Human. The
// keyword line never counts as an ability, so the def's text is `split[1]`.
// M6.4dc, D266.

import { VOICE_OF_THE_PROVINCES } from '../../../data/fixtures/engineCards';
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
  VOICE_OF_THE_PROVINCES,
  'Flying\nWhen this creature enters, create a 1/1 white Human creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN = tokenRef('Human|1/1|W|Creature|');

export const VOICE_OF_THE_PROVINCES_SCRIPT: CardScript = {
  oracleId: VOICE_OF_THE_PROVINCES.oracleId,
  name: VOICE_OF_THE_PROVINCES.name,
  triggers: [
    {
      abilityId: 'etb-human',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Voice of the Provinces — create a 1/1 white Human creature token',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const controller = obj.controller;
        return [
          {
            t: 'TokenCreated',
            card: ctx.ids.nextInstance(),
            oracleId: HUMAN.oracleId,
            printingId: HUMAN.printingId,
            controller,
            owner: controller,
            turnNumber: ctx.state.turn.turnNumber,
          },
        ];
      },
    },
  ],
};
