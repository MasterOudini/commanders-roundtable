// `Ark of Blight` — Artifact, "{3}, {T}, Sacrifice this artifact: Destroy
// target land." The first TARGETED self-sacrifice ActivatedDef: Hedron
// Archive's chargeable cost (D159) under Deserted Temple's targeted resolve
// (CR 608.2b re-check), destroying the way Angel of Despair does — the derived
// target answers for indestructible, because Darksteel Citadel is a land.
// M6.4e, D162.

import { ARK_OF_BLIGHT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARK_OF_BLIGHT, '{3}, {T}, Sacrifice this artifact: Destroy target land.');

export const ARK_OF_BLIGHT_SCRIPT: CardScript = {
  oracleId: ARK_OF_BLIGHT.oracleId,
  name: ARK_OF_BLIGHT.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${ARK_OF_BLIGHT.oracleId}#a0`,
      text: TEXT,
      // The Ark is already in the graveyard when this runs — the sacrifice was
      // charged at activation by `finishAbility` (D159) — so nothing here may
      // ask about `self`'s position.
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b — an indestructible permanent is not destroyed.
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
