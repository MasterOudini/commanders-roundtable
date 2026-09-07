// `Inquisitor Exarch` - a etb trigger gainLife, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INQUISITOR_EXARCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INQUISITOR_EXARCH, "When this creature enters, choose one —\n• You gain 2 life.\n• Target opponent loses 2 life.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "You gain 2 life.", targets: vocabularyTargets("You gain 2 life.") },
  { text: "Target opponent loses 2 life.", targets: vocabularyTargets("Target opponent loses 2 life.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Target opponent loses 2 life.", INQUISITOR_EXARCH.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Target opponent loses 2 life.");

export const INQUISITOR_EXARCH_SCRIPT: CardScript = {
  oracleId: INQUISITOR_EXARCH.oracleId,
  name: INQUISITOR_EXARCH.name,
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
      label: () => "Inquisitor Exarch - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
