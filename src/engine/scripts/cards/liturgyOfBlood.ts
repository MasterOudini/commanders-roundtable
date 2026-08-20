// `Liturgy of Blood` — the destroy pays through an indestructible miss
// (CR 608.2c, Deconstruct's rule): the {B}{B}{B} arrives either way.
// D222.

import { LITURGY_OF_BLOOD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LITURGY_OF_BLOOD, 'Destroy target creature. Add {B}{B}{B}.');

export const LITURGY_OF_BLOOD_SCRIPT: CardScript = {
  oracleId: LITURGY_OF_BLOOD.oracleId,
  name: LITURGY_OF_BLOOD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
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
      events.push({
        t: 'ManaAdded',
        player: obj.controller,
        mana: { ...EMPTY_POOL, B: 3 },
        source: self,
      });
      return events;
    },
  },
};
