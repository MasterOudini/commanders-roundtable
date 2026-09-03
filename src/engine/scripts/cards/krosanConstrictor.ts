// `Krosan Constrictor` - pump on "Target black creature gets -2/-0 until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { KROSAN_CONSTRICTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_CONSTRICTOR, "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)\n{T}: Target black creature gets -2/-0 until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const KROSAN_CONSTRICTOR_SCRIPT: CardScript = {
  oracleId: KROSAN_CONSTRICTOR.oracleId,
  name: KROSAN_CONSTRICTOR.name,
  activated: [
    {
      ref: `${KROSAN_CONSTRICTOR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
