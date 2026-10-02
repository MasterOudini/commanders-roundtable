// `Font of Progress` - a static entersWithCounters, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FONT_OF_PROGRESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FONT_OF_PROGRESS, "This artifact enters with two oil counters on it.\n{3}, {T}: Target player mills X cards, where X is the number of oil counters on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player mills X cards, where X is the number of oil counters on ~.", FONT_OF_PROGRESS.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills X cards, where X is the number of oil counters on ~.");

export const FONT_OF_PROGRESS_SCRIPT: CardScript = {
  oracleId: FONT_OF_PROGRESS.oracleId,
  name: FONT_OF_PROGRESS.name,
  activated: [
    {
      ref: `${FONT_OF_PROGRESS.oracleId}#a0`,
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 2 }] }],
    },
  ],
};
