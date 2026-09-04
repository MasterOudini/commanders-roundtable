// `Ogre Menial` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { OGRE_MENIAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OGRE_MENIAL, "Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\n{R}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const OGRE_MENIAL_SCRIPT: CardScript = {
  oracleId: OGRE_MENIAL.oracleId,
  name: OGRE_MENIAL.name,
  activated: [
    {
      ref: `${OGRE_MENIAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
