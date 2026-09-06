// `Steelbane Hydra` - a static entersWithCountersX, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELBANE_HYDRA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELBANE_HYDRA, "This creature enters with X +1/+1 counters on it.\n{2}{G}, Remove a +1/+1 counter from this creature: Destroy target artifact or enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact or enchantment.", STEELBANE_HYDRA.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact or enchantment.");

export const STEELBANE_HYDRA_SCRIPT: CardScript = {
  oracleId: STEELBANE_HYDRA.oracleId,
  name: STEELBANE_HYDRA.name,
  activated: [
    {
      ref: `${STEELBANE_HYDRA.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D344).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (ctx, self, ev): readonly EventBody[] => {
        // The cast's X, read off the stack object the spell still is (CR 608.2).
        const x = ctx.state.stack.find((o) => o.card === self)?.xValue ?? 0;
        return x > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: x }] }] : [ev];
      },
    },
  ],
};
