// `Infernal Grasp` — "Destroy target creature. You lose 2 life." An
// unconditional destroy (the modern Doom Blade) plus the caster's price.
// The life is lost whether or not the destruction happens — CR 701.7b stops
// the DESTROY at indestructible, not the rest of the spell. D192.

import { INFERNAL_GRASP } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(INFERNAL_GRASP, 'Destroy target creature. You lose 2 life.');

export const INFERNAL_GRASP_SCRIPT: CardScript = {
  oracleId: INFERNAL_GRASP.oracleId,
  name: INFERNAL_GRASP.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card') {
        const card = ctx.state.cards[target.id];
        if (
          card &&
          card.zone.kind === 'battlefield' &&
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
      const player = ctx.state.players[obj.controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -2, to: player.life - 2 });
      }
      return events;
    },
  },
};
