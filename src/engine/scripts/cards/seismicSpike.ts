// `Seismic Spike` — "Destroy target land. Add {R}{R}." The land destroy
// with the ritual rider; an indestructible miss still pays (CR 608.2c,
// Deconstruct's rule). D245.

import { SEISMIC_SPIKE } from '../../../data/fixtures/engineCards';
import { EMPTY_POOL } from '../../types/mana';
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

const TEXT = printed(SEISMIC_SPIKE, 'Destroy target land. Add {R}{R}.');

export const SEISMIC_SPIKE_SCRIPT: CardScript = {
  oracleId: SEISMIC_SPIKE.oracleId,
  name: SEISMIC_SPIKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
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
      events.push({
        t: 'ManaAdded',
        player: obj.controller,
        mana: { ...EMPTY_POOL, R: 2 },
        source: self,
      });
      return events;
    },
  },
};
