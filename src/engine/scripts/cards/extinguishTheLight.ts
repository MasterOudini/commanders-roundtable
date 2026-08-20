// `Extinguish the Light` — "Destroy target creature or planeswalker. If
// its mana value was 3 or less, you gain 3 life." The MV is read BEFORE
// the move and the gain is tied to the permanent, not the destruction
// (the Certain Death precedent). D212.

import { EXTINGUISH_THE_LIGHT } from '../../../data/fixtures/engineCards';
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
  EXTINGUISH_THE_LIGHT,
  'Destroy target creature or planeswalker. If its mana value was 3 or less, you gain 3 life.',
);

export const EXTINGUISH_THE_LIGHT_SCRIPT: CardScript = {
  oracleId: EXTINGUISH_THE_LIGHT.oracleId,
  name: EXTINGUISH_THE_LIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
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
      const me = ctx.state.players[obj.controller];
      if (mv <= 3 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 });
      }
      return events;
    },
  },
};
