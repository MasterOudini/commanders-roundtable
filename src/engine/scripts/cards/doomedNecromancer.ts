// `Doomed Necromancer` — "{B}, {T}, Sacrifice this creature: Return target
// creature card from your graveyard to the battlefield." The FIRST script
// REANIMATION (D171): the target is aimed into the graveyard by D138's zone
// machinery, re-checked to still be there at resolution (CR 608.2b), and
// the return is an ordinary CardsMoved to the battlefield — so the entry
// funnel (loyalty counters, enters-tapped, the pay-to-enter prompt) runs on
// the reanimated permanent for free. The permanent enters under the
// ACTIVATOR's control; the card stays owned by its owner (D138's split,
// same rule one zone over). M6.4o, D171.

import { DOOMED_NECROMANCER } from '../../../data/fixtures/engineCards';
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
  DOOMED_NECROMANCER,
  '{B}, {T}, Sacrifice this creature: Return target creature card from your graveyard to the battlefield.',
);

export const DOOMED_NECROMANCER_SCRIPT: CardScript = {
  oracleId: DOOMED_NECROMANCER.oracleId,
  name: DOOMED_NECROMANCER.name,
  activated: [
    {
      ref: `${DOOMED_NECROMANCER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        if (card.zone.player !== obj.controller) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: card.zone.player },
                to: { kind: 'battlefield', player: obj.controller },
              },
            ],
          },
        ];
      },
    },
  ],
};
