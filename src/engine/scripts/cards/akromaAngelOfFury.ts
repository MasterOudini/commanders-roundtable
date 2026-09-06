// `Akroma, Angel of Fury` - a static cantBeCountered, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AKROMA_ANGEL_OF_FURY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AKROMA_ANGEL_OF_FURY, "This spell can't be countered.\nFlying, trample, protection from white and from blue\n{R}: Akroma gets +1/+0 until end of turn.\nMorph {3}{R}{R}{R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

export const AKROMA_ANGEL_OF_FURY_SCRIPT: CardScript = {
  oracleId: AKROMA_ANGEL_OF_FURY.oracleId,
  name: AKROMA_ANGEL_OF_FURY.name,
  activated: [
    {
      ref: `${AKROMA_ANGEL_OF_FURY.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
