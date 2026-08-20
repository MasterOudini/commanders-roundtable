// `Feed the Swarm` — "Destroy target creature or enchantment an opponent
// controls. You lose life equal to that permanent's mana value." The MV is
// read pre-move and the loss is tied to the permanent (Certain Death's
// precedent). D213.

import { FEED_THE_SWARM } from '../../../data/fixtures/engineCards';
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
  FEED_THE_SWARM,
  "Destroy target creature or enchantment an opponent controls. You lose life equal to that permanent's mana value.",
);

export const FEED_THE_SWARM_SCRIPT: CardScript = {
  oracleId: FEED_THE_SWARM.oracleId,
  name: FEED_THE_SWARM.name,
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
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -mv, to: me.life - mv });
      }
      return events;
    },
  },
};
