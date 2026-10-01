// `Evolution Witness` - an activation vocab, a countersPutOnSelf trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EVOLUTION_WITNESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EVOLUTION_WITNESS, "{1}{G}: Adapt 2. (If this creature has no +1/+1 counters on it, put two +1/+1 counters on it.)\nWhenever one or more +1/+1 counters are put on this creature, return target permanent card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 2.", EVOLUTION_WITNESS.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 2.");
const VOCAB_L1 = vocabularyEffects("Return target permanent card from your graveyard to your hand.", EVOLUTION_WITNESS.name);
const VOCAB_T_L1 = vocabularyTargets("Return target permanent card from your graveyard to your hand.");

export const EVOLUTION_WITNESS_SCRIPT: CardScript = {
  oracleId: EVOLUTION_WITNESS.oracleId,
  name: EVOLUTION_WITNESS.name,
  activated: [
    {
      ref: `${EVOLUTION_WITNESS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'countersPutOnSelf-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Evolution Witness - Return target permanent card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
