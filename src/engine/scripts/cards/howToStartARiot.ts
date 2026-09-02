// `How to Start a Riot` — "Target creature gains menace until end of turn.
// (reminder)\nCreatures target player controls get +2/+0 until end of turn."
// Two specs of different kinds, read BY KIND (D255's discipline; the
// re-check has already fizzled any out-of-order answer, D271): the creature
// gains menace, every creature the targeted player controls is pumped.
// Menace is a grantable keyword (effectParse's list). D276.

import { HOW_TO_START_A_RIOT } from '../../../data/fixtures/engineCards';
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
  HOW_TO_START_A_RIOT,
  "Target creature gains menace until end of turn. (It can't be blocked except by two or more creatures.)\nCreatures target player controls get +2/+0 until end of turn.",
);

export const HOW_TO_START_ARIOT_SCRIPT: CardScript = {
  oracleId: HOW_TO_START_A_RIOT.oracleId,
  name: HOW_TO_START_A_RIOT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const creature = obj.targets.find((t) => t.kind === 'card');
      const player = obj.targets.find((t) => t.kind === 'player');
      const events: EventBody[] = [];
      if (creature && creature.kind === 'card' && ctx.state.cards[creature.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: creature.id, power: 0, toughness: 0, keywords: ['menace'] });
      }
      if (player && player.kind === 'player') {
        for (const id of ctx.state.zones.battlefield) {
          const card = ctx.state.cards[id];
          if (!card || card.controller !== player.id) continue;
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 2, toughness: 0, keywords: [] });
        }
      }
      return events;
    },
  },
};
