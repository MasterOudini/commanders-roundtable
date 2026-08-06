// `Aura Fracture` — "Sacrifice a land: Destroy target enchantment." The
// chooser cost with NO mana at all — the sacrifice IS the whole price — on a
// non-creature source. Destroy answers to indestructible (CR 701.7b), asked
// of the derived target. M6.4l, D169.

import { AURA_FRACTURE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AURA_FRACTURE, 'Sacrifice a land: Destroy target enchantment.');

export const AURA_FRACTURE_SCRIPT: CardScript = {
  oracleId: AURA_FRACTURE.oracleId,
  name: AURA_FRACTURE.name,
  activated: [
    {
      ref: `${AURA_FRACTURE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
