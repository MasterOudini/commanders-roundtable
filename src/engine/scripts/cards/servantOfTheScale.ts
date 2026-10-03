// `Servant of the Scale` - a static entersWithCounters, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERVANT_OF_THE_SCALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERVANT_OF_THE_SCALE, "This creature enters with a +1/+1 counter on it.\nWhen this creature dies, put X +1/+1 counters on target creature you control, where X is the number of +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put X +1/+1 counters on target creature you control, where X is the number of +1/+1 counters on ~.", SERVANT_OF_THE_SCALE.name);
const VOCAB_T_L1 = vocabularyTargets("Put X +1/+1 counters on target creature you control, where X is the number of +1/+1 counters on ~.");

export const SERVANT_OF_THE_SCALE_SCRIPT: CardScript = {
  oracleId: SERVANT_OF_THE_SCALE.oracleId,
  name: SERVANT_OF_THE_SCALE.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Servant of the Scale - Put X +1/+1 counters on target creature you control, where X is the number of +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }],
    },
  ],
};
