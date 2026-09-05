// `Wydwen, the Biting Gale` - an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WYDWEN_THE_BITING_GALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WYDWEN_THE_BITING_GALE, "Flash\nFlying\n{U}{B}, Pay 1 life: Return Wydwen to its owner's hand.");
const LINES = PRINTED.split('\n');

export const WYDWEN_THE_BITING_GALE_SCRIPT: CardScript = {
  oracleId: WYDWEN_THE_BITING_GALE.oracleId,
  name: WYDWEN_THE_BITING_GALE.name,
  activated: [
    {
      ref: `${WYDWEN_THE_BITING_GALE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
