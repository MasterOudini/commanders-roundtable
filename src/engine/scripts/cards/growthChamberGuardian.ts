// `Growth-Chamber Guardian` - an activation vocab, a countersPutOnSelf trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GROWTH_CHAMBER_GUARDIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GROWTH_CHAMBER_GUARDIAN, "{2}{G}: Adapt 2. (If this creature has no +1/+1 counters on it, put two +1/+1 counters on it.)\nWhenever one or more +1/+1 counters are put on this creature, you may search your library for a card named Growth-Chamber Guardian, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 2.", GROWTH_CHAMBER_GUARDIAN.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 2.");
const VOCAB_L1 = vocabularyEffects("Search your library for a card named ~, reveal it, put it into your hand, then shuffle.", GROWTH_CHAMBER_GUARDIAN.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a card named ~, reveal it, put it into your hand, then shuffle.");

export const GROWTH_CHAMBER_GUARDIAN_SCRIPT: CardScript = {
  oracleId: GROWTH_CHAMBER_GUARDIAN.oracleId,
  name: GROWTH_CHAMBER_GUARDIAN.name,
  activated: [
    {
      ref: `${GROWTH_CHAMBER_GUARDIAN.oracleId}#a0`,
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
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Growth-Chamber Guardian - Search your library for a card named ~, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
