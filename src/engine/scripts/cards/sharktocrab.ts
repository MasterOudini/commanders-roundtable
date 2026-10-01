// `Sharktocrab` - an activation vocab, a countersPutOnSelf trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHARKTOCRAB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHARKTOCRAB, "{2}{G}{U}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)\nWhenever one or more +1/+1 counters are put on this creature, tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 1.", SHARKTOCRAB.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 1.");
const VOCAB_L1 = vocabularyEffects("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.", SHARKTOCRAB.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");

export const SHARKTOCRAB_SCRIPT: CardScript = {
  oracleId: SHARKTOCRAB.oracleId,
  name: SHARKTOCRAB.name,
  activated: [
    {
      ref: `${SHARKTOCRAB.oracleId}#a0`,
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
      label: () => "Sharktocrab - Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
