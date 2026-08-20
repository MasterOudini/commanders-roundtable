// `Divine Offering` — "Destroy target artifact. You gain life equal to its
// mana value." The MV is the printing's, read BEFORE the move; the gain is
// tied to the artifact, not the destruction (the Certain Death precedent),
// so an indestructible survivor still pays. D209.

import { DIVINE_OFFERING } from '../../../data/fixtures/engineCards';
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
  DIVINE_OFFERING,
  'Destroy target artifact. You gain life equal to its mana value.',
);

export const DIVINE_OFFERING_SCRIPT: CardScript = {
  oracleId: DIVINE_OFFERING.oracleId,
  name: DIVINE_OFFERING.name,
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
      if (mv > 0 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: mv, to: me.life + mv });
      }
      return events;
    },
  },
};
