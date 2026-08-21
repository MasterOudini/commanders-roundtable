// `Stream of Unconsciousness` — the debuff with a WIZARD-conditioned draw:
// the census reads derived subtypes across my board, and the Kindred type
// line changes nothing about how the text is claimed. D254.

import { STREAM_OF_UNCONSCIOUSNESS } from '../../../data/fixtures/engineCards';
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
  STREAM_OF_UNCONSCIOUSNESS,
  'Target creature gets -4/-0 until end of turn. If you control a Wizard, draw a card.',
);

export const STREAM_OF_UNCONSCIOUSNESS_SCRIPT: CardScript = {
  oracleId: STREAM_OF_UNCONSCIOUSNESS.oracleId,
  name: STREAM_OF_UNCONSCIOUSNESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -4, toughness: 0 },
      ];
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
