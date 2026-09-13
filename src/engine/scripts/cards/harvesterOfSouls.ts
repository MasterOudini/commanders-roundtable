// `Harvester of Souls` - a anotherCreatureDies trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARVESTER_OF_SOULS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARVESTER_OF_SOULS, "Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)\nWhenever another nontoken creature dies, you may draw a card.");
const LINES = PRINTED.split('\n');

export const HARVESTER_OF_SOULS_SCRIPT: CardScript = {
  oracleId: HARVESTER_OF_SOULS.oracleId,
  name: HARVESTER_OF_SOULS.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Harvester of Souls - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
