// `Reaping Willow` - a static entersWithCounters, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REAPING_WILLOW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(REAPING_WILLOW, "Lifelink\nThis creature enters with two -1/-1 counters on it.\n{1}{W/B}, Remove two counters from this creature: Return target creature card with mana value 3 or less from your graveyard to the battlefield. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target creature card with mana value 3 or less from your graveyard to the battlefield.", REAPING_WILLOW.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card with mana value 3 or less from your graveyard to the battlefield.");

export const REAPING_WILLOW_SCRIPT: CardScript = {
  oracleId: REAPING_WILLOW.oracleId,
  name: REAPING_WILLOW.name,
  activated: [
    {
      ref: `${REAPING_WILLOW.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 2 }] }],
    },
  ],
};
