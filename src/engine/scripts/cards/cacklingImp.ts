// `Cackling Imp` — "Flying\n{T}: Target player loses 1 life." Bile Urchin's
// drain behind a plain tap cost. M6.4i, D166.

import { CACKLING_IMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CACKLING_IMP, 'Flying\n{T}: Target player loses 1 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const CACKLING_IMP_SCRIPT: CardScript = {
  oracleId: CACKLING_IMP.oracleId,
  name: CACKLING_IMP.name,
  activated: [
    {
      // The keyword line parses as nothing; the drain is ability 0.
      ref: `${CACKLING_IMP.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const player = ctx.state.players[target.id];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: player.life - 1 }];
      },
    },
  ],
};
