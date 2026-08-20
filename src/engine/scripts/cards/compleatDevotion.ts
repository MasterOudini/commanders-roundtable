// `Compleat Devotion` — "Target creature you control gets +2/+2 until end
// of turn. If that creature has toxic, draw a card." Toxic is DERIVED
// (`toxicAmount > 0`). D204.

import { COMPLEAT_DEVOTION } from '../../../data/fixtures/engineCards';
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
  COMPLEAT_DEVOTION,
  'Target creature you control gets +2/+2 until end of turn. If that creature has toxic, draw a card.',
);

export const COMPLEAT_DEVOTION_SCRIPT: CardScript = {
  oracleId: COMPLEAT_DEVOTION.oracleId,
  name: COMPLEAT_DEVOTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 },
      ];
      if (ctx.derive(target.id).toxicAmount > 0) {
        events.push(...drawEvents(ctx.state, obj.controller, 1));
      }
      return events;
    },
  },
};
