// `Flametongue Yearling` - a static entersWithCountersPer, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAMETONGUE_YEARLING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAMETONGUE_YEARLING, "Multikicker {2} (You may pay an additional {2} any number of times as you cast this spell.)\nThis creature enters with a +1/+1 counter on it for each time it was kicked.\nWhen this creature enters, it deals damage equal to its power to target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("~ deals damage equal to its power to target creature.", FLAMETONGUE_YEARLING.name);
const VOCAB_T_L2 = vocabularyTargets("~ deals damage equal to its power to target creature.");

export const FLAMETONGUE_YEARLING_SCRIPT: CardScript = {
  oracleId: FLAMETONGUE_YEARLING.oracleId,
  name: FLAMETONGUE_YEARLING.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Flametongue Yearling - ~ deals damage equal to its power to target creature.",
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
      replace: (_ctx, self, ev): readonly EventBody[] => {
        // D529 - the multikicker's count: the kicks the entering spell was cast with, off the move (CR 702.33c).
        const n = ev.t === 'CardsMoved' ? (ev.moves.find((m) => m.card === self)?.kicked ?? 0) : 0;
        return n > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: n }] }] : [ev];
      },
    },
  ],
};
