// `Golgari Rotwurm` — "{B}, Sacrifice a creature: Target player loses 1
// life." The D168 creature chooser (it may pay with ITSELF, CR 113.7a) on
// Bile Urchin's player-target payload. M6.4u, D177.

import { GOLGARI_ROTWURM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GOLGARI_ROTWURM, '{B}, Sacrifice a creature: Target player loses 1 life.');

export const GOLGARI_ROTWURM_SCRIPT: CardScript = {
  oracleId: GOLGARI_ROTWURM.oracleId,
  name: GOLGARI_ROTWURM.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GOLGARI_ROTWURM.oracleId}#a0`,
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
