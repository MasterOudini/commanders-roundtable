// `Energy Tap` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { ENERGY_TAP } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { CardInstance } from '../../types/state';

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

const TEXT = printed(ENERGY_TAP, "Tap target untapped creature you control. If you do, add an amount of {C} equal to that creature's mana value.");

export const ENERGY_TAP_SCRIPT: CardScript = {
  oracleId: ENERGY_TAP.oracleId,
  name: ENERGY_TAP.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const perm = (i: number): { id: InstanceId; card: CardInstance } | null => {
        const t = obj.targets[i];
        if (!t || t.kind !== 'card') return null;
        const card = ctx.state.cards[t.id];
        return card && card.zone.kind === 'battlefield' ? { id: t.id, card } : null;
      };
        { const p = perm(0); if (p && !p.card.tapped) events.push({ t: 'PermanentsTapped', cards: [p.id] }); }
        { const p = perm(0); if (p && !p.card.tapped) { const mv = ctx.derive(p.id).manaValue ?? 0; if (mv > 0) events.push({ t: 'ManaAdded', player: obj.controller, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: mv }, source: self }); } }
      return events;
    },
  },
};
