// `Pearl Lake Ancient` - a static cantBeCountered, an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PEARL_LAKE_ANCIENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PEARL_LAKE_ANCIENT, "Flash\nThis spell can't be countered.\nProwess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nReturn three lands you control to their owner's hand: Return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

export const PEARL_LAKE_ANCIENT_SCRIPT: CardScript = {
  oracleId: PEARL_LAKE_ANCIENT.oracleId,
  name: PEARL_LAKE_ANCIENT.name,
  activated: [
    {
      ref: `${PEARL_LAKE_ANCIENT.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  cantBeCountered: { abilityId: 'cant-be-countered-1', text: LINES[1] as string },
};
