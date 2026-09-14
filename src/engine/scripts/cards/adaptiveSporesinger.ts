// `Adaptive Sporesinger` - a etb trigger pumpTarget, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ADAPTIVE_SPORESINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ADAPTIVE_SPORESINGER, "Vigilance\nWhen this creature enters, choose one —\n• Target creature gets +2/+2 and gains vigilance until end of turn.\n• Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const MODES_L1 = [
  { text: "Target creature gets +2/+2 and gains vigilance until end of turn.", targets: vocabularyTargets("Target creature gets +2/+2 and gains vigilance until end of turn.") },
  { text: "Proliferate.", targets: vocabularyTargets("Proliferate.") },
];

const VOCAB_L1_m1 = vocabularyEffects("Proliferate.", ADAPTIVE_SPORESINGER.name);
const VOCAB_T_L1_m1 = vocabularyTargets("Proliferate.");

export const ADAPTIVE_SPORESINGER_SCRIPT: CardScript = {
  oracleId: ADAPTIVE_SPORESINGER.oracleId,
  name: ADAPTIVE_SPORESINGER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Adaptive Sporesinger - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: ["vigilance"] }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L1_m1, VOCAB_T_L1_m1);
        }
        return [];
      },
    },
  ],
};
