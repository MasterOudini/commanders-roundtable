// `Mothrider Patrol` — "{3}{W}, {T}: Tap target creature." The Trapper
// family's tap at a steeper price, behind Flying (the keyword line never
// counts — the tap is #a0). D226.

import { MOTHRIDER_PATROL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOTHRIDER_PATROL, 'Flying\n{3}{W}, {T}: Tap target creature.');
const TEXT = PRINTED.split('\n')[1] as string;

export const MOTHRIDER_PATROL_SCRIPT: CardScript = {
  oracleId: MOTHRIDER_PATROL.oracleId,
  name: MOTHRIDER_PATROL.name,
  activated: [
    {
      ref: `${MOTHRIDER_PATROL.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
