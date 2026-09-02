// `Withering Torment` — the creature-or-enchantment compound (D266's Viridian
// Zealot) plus a flat 2-life bill on ME.
//
// ⚠️ The life is paid whether or not the destroy lands: an indestructible
// target survives and I still lose 2, the same asymmetry D267's Victorious
// Destruction pins on the other side of the table. D270.

import { WITHERING_TORMENT } from '../../../data/fixtures/engineCards';
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
  WITHERING_TORMENT,
  'Destroy target creature or enchantment. You lose 2 life.',
);

export const WITHERING_TORMENT_SCRIPT: CardScript = {
  oracleId: WITHERING_TORMENT.oracleId,
  name: WITHERING_TORMENT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];

      const target = obj.targets[0];
      if (target && target.kind === 'card') {
        const card = ctx.state.cards[target.id];
        if (
          card?.zone.kind === 'battlefield' &&
          !ctx.derive(target.id).keywords.has('indestructible')
        ) {
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
      }

      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 });
      }
      return events;
    },
  },
};
