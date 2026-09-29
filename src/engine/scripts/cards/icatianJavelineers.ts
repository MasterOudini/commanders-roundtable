// `Icatian Javelineers` - a static entersWithCounters, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICATIAN_JAVELINEERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICATIAN_JAVELINEERS, "This creature enters with a javelin counter on it.\n{T}, Remove a javelin counter from this creature: It deals 1 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("It deals 1 damage to any target.", ICATIAN_JAVELINEERS.name);
const VOCAB_T_A0 = vocabularyTargets("It deals 1 damage to any target.");

export const ICATIAN_JAVELINEERS_SCRIPT: CardScript = {
  oracleId: ICATIAN_JAVELINEERS.oracleId,
  name: ICATIAN_JAVELINEERS.name,
  activated: [
    {
      ref: `${ICATIAN_JAVELINEERS.oracleId}#a0`,
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "javelin", delta: 1 }] }],
    },
  ],
};
