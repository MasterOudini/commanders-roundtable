// `Chilling Trap` — "Target creature gets -4/-0 until end of turn. If you
// control a Wizard, draw a card." The Wizard is a board query at
// resolution (derived subtypes). D203.

import { CHILLING_TRAP } from '../../../data/fixtures/engineCards';
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
  CHILLING_TRAP,
  'Target creature gets -4/-0 until end of turn. If you control a Wizard, draw a card.',
);

export const CHILLING_TRAP_SCRIPT: CardScript = {
  oracleId: CHILLING_TRAP.oracleId,
  name: CHILLING_TRAP.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -4, toughness: 0 });
      }
      let wizard = false;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Wizard')) {
          wizard = true;
          break;
        }
      }
      if (wizard) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
