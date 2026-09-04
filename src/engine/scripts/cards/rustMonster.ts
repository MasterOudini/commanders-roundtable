// `Rust Monster` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUST_MONSTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUST_MONSTER, "First strike\nSacrifice an artifact: This creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const RUST_MONSTER_SCRIPT: CardScript = {
  oracleId: RUST_MONSTER.oracleId,
  name: RUST_MONSTER.name,
  activated: [
    {
      ref: `${RUST_MONSTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
