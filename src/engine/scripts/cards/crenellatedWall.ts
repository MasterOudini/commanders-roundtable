// `Crenellated Wall` — "Defender\n{T}: Target creature gets +0/+4 until end
// of turn." A targeted {T} pump behind an engine keyword line: ability 0.
// M6.4l, D169.

import { CRENELLATED_WALL } from '../../../data/fixtures/engineCards';
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
  CRENELLATED_WALL,
  "Defender (This creature can't attack.)\n{T}: Target creature gets +0/+4 until end of turn.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const CRENELLATED_WALL_SCRIPT: CardScript = {
  oracleId: CRENELLATED_WALL.oracleId,
  name: CRENELLATED_WALL.name,
  activated: [
    {
      ref: `${CRENELLATED_WALL.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 4 }];
      },
    },
  ],
};
