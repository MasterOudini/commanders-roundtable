// `Chaotic Goo` - a static entersWithCounters, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHAOTIC_GOO } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(CHAOTIC_GOO, "This creature enters with three +1/+1 counters on it.\nAt the beginning of your upkeep, you may flip a coin. If you win the flip, put a +1/+1 counter on this creature. If you lose the flip, remove a +1/+1 counter from this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Flip a coin. If you win the flip, put a +1/+1 counter on this creature. If you lose the flip, remove a +1/+1 counter from this creature.", CHAOTIC_GOO.name);
const VOCAB_T_L1 = vocabularyTargets("Flip a coin. If you win the flip, put a +1/+1 counter on this creature. If you lose the flip, remove a +1/+1 counter from this creature.");

export const CHAOTIC_GOO_SCRIPT: CardScript = {
  oracleId: CHAOTIC_GOO.oracleId,
  name: CHAOTIC_GOO.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Chaotic Goo - Flip a coin. If you win the flip, put a +1/+1 counter on this creature. If you lose the flip, remove a +1/+1 counter from this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 3 }] }],
    },
  ],
};
