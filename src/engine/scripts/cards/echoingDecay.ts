// `Echoing Decay` — "Target creature and all other creatures with the
// same name as that creature get -2/-2 until end of turn." Echoing
// Courage's mirror; the SBA does the killing. D210.

import { ECHOING_DECAY } from '../../../data/fixtures/engineCards';
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
  ECHOING_DECAY,
  'Target creature and all other creatures with the same name as that creature get -2/-2 until end of turn.',
);

export const ECHOING_DECAY_SCRIPT: CardScript = {
  oracleId: ECHOING_DECAY.oracleId,
  name: ECHOING_DECAY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const isTarget = id === target.id;
        if (!isTarget) {
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        }
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: -2 });
      }
      return events;
    },
  },
};
