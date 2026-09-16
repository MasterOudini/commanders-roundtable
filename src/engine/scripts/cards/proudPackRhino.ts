// `Proud Pack-Rhino` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROUD_PACK_RHINO } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(PROUD_PACK_RHINO, "When this creature enters, choose one —\n• Put a shield counter on target permanent. (If it would be dealt damage or destroyed, remove a shield counter from it instead.)\n• Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Put a shield counter on target permanent.", targets: vocabularyTargets("Put a shield counter on target permanent.") },
  { text: "Proliferate.", targets: vocabularyTargets("Proliferate.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Put a shield counter on target permanent.", PROUD_PACK_RHINO.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Put a shield counter on target permanent.");
const VOCAB_L0_m1 = vocabularyEffects("Proliferate.", PROUD_PACK_RHINO.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Proliferate.");

export const PROUD_PACK_RHINO_SCRIPT: CardScript = {
  oracleId: PROUD_PACK_RHINO.oracleId,
  name: PROUD_PACK_RHINO.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Proud Pack-Rhino - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
