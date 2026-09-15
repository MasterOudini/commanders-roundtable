// `Brambleback Brute` - a static entersWithCounters, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRAMBLEBACK_BRUTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRAMBLEBACK_BRUTE, "This creature enters with two -1/-1 counters on it.\n{1}{R}, Remove a counter from this creature: Target creature can't block this turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", BRAMBLEBACK_BRUTE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const BRAMBLEBACK_BRUTE_SCRIPT: CardScript = {
  oracleId: BRAMBLEBACK_BRUTE.oracleId,
  name: BRAMBLEBACK_BRUTE.name,
  activated: [
    {
      ref: `${BRAMBLEBACK_BRUTE.oracleId}#a0`,
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
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 2 }] }],
    },
  ],
};
