// `Deconstruct` — "Destroy target artifact. Add {G}{G}{G}." The mana comes
// whether or not the artifact dies (indestructible stops the destroy, not
// the ritual — CR 608.2c applies each part as far as possible). D207.

import { DECONSTRUCT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DECONSTRUCT, 'Destroy target artifact. Add {G}{G}{G}.');

export const DECONSTRUCT_SCRIPT: CardScript = {
  oracleId: DECONSTRUCT.oracleId,
  name: DECONSTRUCT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card') {
        const card = ctx.state.cards[target.id];
        if (card && card.zone.kind === 'battlefield') {
          const d = ctx.derive(target.id);
          if (!d.keywords.has('indestructible')) {
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
      }
      events.push({
        t: 'ManaAdded',
        player: obj.controller,
        mana: { ...EMPTY_POOL, G: 3 },
        source: self,
      });
      return events;
    },
  },
};
