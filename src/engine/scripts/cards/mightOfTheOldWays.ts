// `Might of the Old Ways` — "Target creature gets +2/+2 until end of
// turn.\nCoven — Then if you control three or more creatures with different
// powers, draw a card." Coven is an ability word (Radiance's rule, D270):
// the rider counts DISTINCT derived powers among the creatures I control,
// with the target's fresh +2 already applied — "then" means after the pump,
// and the pump event has not landed while this resolve is still running.
// D277.

import { MIGHT_OF_THE_OLD_WAYS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  MIGHT_OF_THE_OLD_WAYS,
  'Target creature gets +2/+2 until end of turn.\nCoven — Then if you control three or more creatures with different powers, draw a card.',
);

export const MIGHT_OF_THE_OLD_WAYS_SCRIPT: CardScript = {
  oracleId: MIGHT_OF_THE_OLD_WAYS.oracleId,
  name: MIGHT_OF_THE_OLD_WAYS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] },
      ];
      const powers = new Set<number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') || d.power === null) continue;
        powers.add(id === target.id ? d.power + 2 : d.power);
      }
      if (powers.size >= 3) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
