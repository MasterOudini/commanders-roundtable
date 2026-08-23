// `Think Tank` — the upkeep surveil: Geist of the Archives' MY-upkeep filter
// (D215) with the surveil ask instead of a scry. The pool's next
// enchantment. D259.

import { THINK_TANK } from '../../../data/fixtures/engineCards';
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
  THINK_TANK,
  'At the beginning of your upkeep, surveil 1. (Look at the top card of your library. You may put that card into your graveyard.)',
);

export const THINK_TANK_SCRIPT: CardScript = {
  oracleId: THINK_TANK.oracleId,
  name: THINK_TANK.name,
  triggers: [
    {
      abilityId: 'upkeep-surveil',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'upkeep' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Think Tank — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
