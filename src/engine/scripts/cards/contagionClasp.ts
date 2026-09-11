// `Contagion Clasp` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONTAGION_CLASP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONTAGION_CLASP, "When this artifact enters, put a -1/-1 counter on target creature.\n{4}, {T}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a -1/-1 counter on target creature.", CONTAGION_CLASP.name);
const VOCAB_T_L0 = vocabularyTargets("Put a -1/-1 counter on target creature.");
const VOCAB_A0 = vocabularyEffects("Proliferate.", CONTAGION_CLASP.name);
const VOCAB_T_A0 = vocabularyTargets("Proliferate.");

export const CONTAGION_CLASP_SCRIPT: CardScript = {
  oracleId: CONTAGION_CLASP.oracleId,
  name: CONTAGION_CLASP.name,
  activated: [
    {
      ref: `${CONTAGION_CLASP.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Contagion Clasp - Put a -1/-1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
