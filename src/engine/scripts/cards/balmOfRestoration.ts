// `Balm of Restoration` - an activation gainLife, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALM_OF_RESTORATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALM_OF_RESTORATION, "{1}, {T}, Sacrifice this artifact: Choose one —\n• You gain 2 life.\n• Prevent the next 2 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const MODES_A0 = [
  { text: "You gain 2 life.", targets: vocabularyTargets("You gain 2 life.") },
  { text: "Prevent the next 2 damage that would be dealt to any target this turn.", targets: vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.") },
];

const VOCAB_A0_m1 = vocabularyEffects("Prevent the next 2 damage that would be dealt to any target this turn.", BALM_OF_RESTORATION.name);
const VOCAB_T_A0_m1 = vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.");

export const BALM_OF_RESTORATION_SCRIPT: CardScript = {
  oracleId: BALM_OF_RESTORATION.oracleId,
  name: BALM_OF_RESTORATION.name,
  activated: [
    {
      ref: `${BALM_OF_RESTORATION.oracleId}#a0`,
      text: LINES[0] as string,
      modes: MODES_A0,
      modeChoice: { min: 1, max: 1 },
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_A0_m1, VOCAB_T_A0_m1);
        }
        return [];
      },
    },
  ],
};
