// `Tumble Magnet` - a static entersWithCounters, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TUMBLE_MAGNET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TUMBLE_MAGNET, "This artifact enters with three charge counters on it.\n{T}, Remove a charge counter from this artifact: Tap target artifact or creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Tap target artifact or creature.", TUMBLE_MAGNET.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target artifact or creature.");

export const TUMBLE_MAGNET_SCRIPT: CardScript = {
  oracleId: TUMBLE_MAGNET.oracleId,
  name: TUMBLE_MAGNET.name,
  activated: [
    {
      ref: `${TUMBLE_MAGNET.oracleId}#a0`,
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 3 }] }],
    },
  ],
};
