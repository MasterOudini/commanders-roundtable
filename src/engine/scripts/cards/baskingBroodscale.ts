// `Basking Broodscale` - an activation vocab, a countersPutOnSelf trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BASKING_BROODSCALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BASKING_BROODSCALE, "Devoid (This card has no color.)\n{1}{G}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)\nWhenever one or more +1/+1 counters are put on this creature, you may create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 1.", BASKING_BROODSCALE.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 1.");
const VOCAB_L2 = vocabularyEffects("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"", BASKING_BROODSCALE.name);
const VOCAB_T_L2 = vocabularyTargets("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");

export const BASKING_BROODSCALE_SCRIPT: CardScript = {
  oracleId: BASKING_BROODSCALE.oracleId,
  name: BASKING_BROODSCALE.name,
  activated: [
    {
      ref: `${BASKING_BROODSCALE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'countersPutOnSelf-2',
      text: LINES[2] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Basking Broodscale - Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
