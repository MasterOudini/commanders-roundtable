// `Reclaiming Vines` — "Destroy target artifact, enchantment, or land."
// The Icy triple, probed with all three arms ENFORCED. D238.

import { RECLAIMING_VINES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RECLAIMING_VINES, 'Destroy target artifact, enchantment, or land.');

export const RECLAIMING_VINES_SCRIPT: CardScript = {
  oracleId: RECLAIMING_VINES.oracleId,
  name: RECLAIMING_VINES.name,
  spell: {
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
};
