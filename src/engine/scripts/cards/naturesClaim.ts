// `Nature's Claim` — "Destroy target artifact or enchantment. Its
// controller gains 4 life." The Icy compound with the controller paid,
// read BEFORE the move; the gain is its own sentence and an
// indestructible miss still pays. D227.

import { NATURE_S_CLAIM } from '../../../data/fixtures/engineCards';
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
  NATURE_S_CLAIM,
  'Destroy target artifact or enchantment. Its controller gains 4 life.',
);

export const NATURES_CLAIM_SCRIPT: CardScript = {
  oracleId: NATURE_S_CLAIM.oracleId,
  name: NATURE_S_CLAIM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const p = ctx.state.players[controller];
      if (p && !p.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: 4, to: p.life + 4 });
      }
      return events;
    },
  },
};
