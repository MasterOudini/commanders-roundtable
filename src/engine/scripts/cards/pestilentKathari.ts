// `Pestilent Kathari` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { PESTILENT_KATHARI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PESTILENT_KATHARI, "Flying\nDeathtouch (Any amount of damage this deals to a creature is enough to destroy it.)\n{2}{R}: This creature gains first strike until end of turn.");
const LINES = PRINTED.split('\n');

export const PESTILENT_KATHARI_SCRIPT: CardScript = {
  oracleId: PESTILENT_KATHARI.oracleId,
  name: PESTILENT_KATHARI.name,
  activated: [
    {
      ref: `${PESTILENT_KATHARI.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
