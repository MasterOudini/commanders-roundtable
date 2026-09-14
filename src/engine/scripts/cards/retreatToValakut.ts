// `Retreat to Valakut` - a landfall trigger pumpTarget, a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RETREAT_TO_VALAKUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RETREAT_TO_VALAKUT, "Landfall — Whenever a land you control enters, choose one —\n• Target creature gets +2/+0 until end of turn.\n• Target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Target creature gets +2/+0 until end of turn.", targets: vocabularyTargets("Target creature gets +2/+0 until end of turn.") },
  { text: "Target creature can't block this turn.", targets: vocabularyTargets("Target creature can't block this turn.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Target creature can't block this turn.", RETREAT_TO_VALAKUT.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Target creature can't block this turn.");

export const RETREAT_TO_VALAKUT_SCRIPT: CardScript = {
  oracleId: RETREAT_TO_VALAKUT.oracleId,
  name: RETREAT_TO_VALAKUT.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Retreat to Valakut - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
