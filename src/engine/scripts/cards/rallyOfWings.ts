// `Rally of Wings` — "Untap all creatures you control. Creatures you
// control with flying get +2/+2 until end of turn." The untap sweep
// with the flyer-only pump, both filters DERIVED. D237.

import { RALLY_OF_WINGS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  RALLY_OF_WINGS,
  'Untap all creatures you control. Creatures you control with flying get +2/+2 until end of turn.',
);

export const RALLY_OF_WINGS_SCRIPT: CardScript = {
  oracleId: RALLY_OF_WINGS.oracleId,
  name: RALLY_OF_WINGS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const untap: InstanceId[] = [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (card.tapped) untap.push(id);
        if (d.keywords.has('flying')) {
          events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 2, toughness: 2 });
        }
      }
      if (untap.length > 0) events.unshift({ t: 'PermanentsUntapped', cards: untap });
      return events;
    },
  },
};
