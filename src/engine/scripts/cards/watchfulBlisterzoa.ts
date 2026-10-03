// `Watchful Blisterzoa` - a static entersWithCounters, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WATCHFUL_BLISTERZOA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WATCHFUL_BLISTERZOA, "Flying\nThis creature enters with an oil counter on it.\nWhen this creature dies, draw cards equal to the number of oil counters on it.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw cards equal to the number of oil counters on ~.", WATCHFUL_BLISTERZOA.name);
const VOCAB_T_L2 = vocabularyTargets("Draw cards equal to the number of oil counters on ~.");

export const WATCHFUL_BLISTERZOA_SCRIPT: CardScript = {
  oracleId: WATCHFUL_BLISTERZOA.oracleId,
  name: WATCHFUL_BLISTERZOA.name,
  triggers: [
    {
      abilityId: 'dies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Watchful Blisterzoa - Draw cards equal to the number of oil counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }],
    },
  ],
};
