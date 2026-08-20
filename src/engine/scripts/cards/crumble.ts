// `Crumble` — "Destroy target artifact. It can't be regenerated. That
// artifact's controller gains life equal to its mana value." Controller
// and mana value read BEFORE the move; the regeneration clause is vacuous
// under the tripwire. Indestructible survives and nobody gains. D205.

import { CRUMBLE } from '../../../data/fixtures/engineCards';
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
  CRUMBLE,
  "Destroy target artifact. It can't be regenerated. That artifact's controller gains life equal to its mana value.",
);

export const CRUMBLE_SCRIPT: CardScript = {
  oracleId: CRUMBLE.oracleId,
  name: CRUMBLE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (ctx.derive(target.id).keywords.has('indestructible')) return [];
      const controller = card.controller;
      const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
      const events: EventBody[] = [
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
      if (mv > 0) {
        const life = ctx.state.players[controller]?.life ?? 0;
        events.push({ t: 'LifeChanged', player: controller, delta: mv, to: life + mv });
      }
      return events;
    },
  },
};
