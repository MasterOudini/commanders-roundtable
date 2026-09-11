// `Merfolk Skydiver` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERFOLK_SKYDIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERFOLK_SKYDIVER, "Flying\nWhen this creature enters, put a +1/+1 counter on target creature you control.\n{3}{G}{U}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature you control.", MERFOLK_SKYDIVER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature you control.");
const VOCAB_A0 = vocabularyEffects("Proliferate.", MERFOLK_SKYDIVER.name);
const VOCAB_T_A0 = vocabularyTargets("Proliferate.");

export const MERFOLK_SKYDIVER_SCRIPT: CardScript = {
  oracleId: MERFOLK_SKYDIVER.oracleId,
  name: MERFOLK_SKYDIVER.name,
  activated: [
    {
      ref: `${MERFOLK_SKYDIVER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Merfolk Skydiver - Put a +1/+1 counter on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
