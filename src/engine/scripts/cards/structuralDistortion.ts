// `Structural Distortion` — the probed 'artifact or land' compound EXILED,
// with the controller read BEFORE the move so the 2 lands either way
// (Smash to Smithereens' rider order, exile instead of destroy — and
// exile is not destruction, so there is no indestructible check). D254.

import { STRUCTURAL_DISTORTION } from '../../../data/fixtures/engineCards';
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
  STRUCTURAL_DISTORTION,
  "Exile target artifact or land. Structural Distortion deals 2 damage to that permanent's controller.",
);

export const STRUCTURAL_DISTORTION_SCRIPT: CardScript = {
  oracleId: STRUCTURAL_DISTORTION.oracleId,
  name: STRUCTURAL_DISTORTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: controller },
              amount: 2,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
      return events;
    },
  },
};
