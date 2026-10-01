// `Dreamdrinker Vampire` - an activation vocab, a countersPutOnSelf trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAMDRINKER_VAMPIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAMDRINKER_VAMPIRE, "Lifelink\n{1}{B}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)\nWhenever one or more +1/+1 counters are put on this creature, it gains menace until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 1.", DREAMDRINKER_VAMPIRE.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 1.");

export const DREAMDRINKER_VAMPIRE_SCRIPT: CardScript = {
  oracleId: DREAMDRINKER_VAMPIRE.oracleId,
  name: DREAMDRINKER_VAMPIRE.name,
  activated: [
    {
      ref: `${DREAMDRINKER_VAMPIRE.oracleId}#a0`,
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
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Dreamdrinker Vampire - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
