// `Wardens of the Cycle` - a endStep trigger gainLife, a endStep trigger drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WARDENS_OF_THE_CYCLE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(WARDENS_OF_THE_CYCLE, "Morbid — At the beginning of your end step, if a creature died this turn, choose one —\n• You gain 2 life.\n• You draw a card and you lose 1 life.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "You gain 2 life.", targets: vocabularyTargets("You gain 2 life.") },
  { text: "You draw a card and you lose 1 life.", targets: vocabularyTargets("You draw a card and you lose 1 life.") },
];

export const WARDENS_OF_THE_CYCLE_SCRIPT: CardScript = {
  oracleId: WARDENS_OF_THE_CYCLE.oracleId,
  name: WARDENS_OF_THE_CYCLE.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Wardens of the Cycle - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
        }
        if (chosen === 1) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
        }
        return [];
      },
    },
  ],
};
