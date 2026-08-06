// `Agent of Shauku` — "{1}{B}, Sacrifice a land: Target creature gets +2/+0
// until end of turn." The FIRST sacrifice-cost def with a TARGET (D169): the
// pick rides the intent (D168), the engine stages the target prompt
// (CR 601.2c's analog for the staged path), and the def only reads
// `obj.targets`. M6.4l, D169.

import { AGENT_OF_SHAUKU } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  AGENT_OF_SHAUKU,
  '{1}{B}, Sacrifice a land: Target creature gets +2/+0 until end of turn.',
);

export const AGENT_OF_SHAUKU_SCRIPT: CardScript = {
  oracleId: AGENT_OF_SHAUKU.oracleId,
  name: AGENT_OF_SHAUKU.name,
  activated: [
    {
      ref: `${AGENT_OF_SHAUKU.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
      },
    },
  ],
};
