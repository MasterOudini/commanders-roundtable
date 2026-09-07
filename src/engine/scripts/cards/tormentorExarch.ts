// `Tormentor Exarch` - a etb trigger pumpTarget, a etb trigger pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TORMENTOR_EXARCH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(TORMENTOR_EXARCH, "When this creature enters, choose one —\n• Target creature gets +2/+0 until end of turn.\n• Target creature gets -0/-2 until end of turn.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Target creature gets +2/+0 until end of turn.", targets: vocabularyTargets("Target creature gets +2/+0 until end of turn.") },
  { text: "Target creature gets -0/-2 until end of turn.", targets: vocabularyTargets("Target creature gets -0/-2 until end of turn.") },
];

export const TORMENTOR_EXARCH_SCRIPT: CardScript = {
  oracleId: TORMENTOR_EXARCH.oracleId,
  name: TORMENTOR_EXARCH.name,
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
      label: () => "Tormentor Exarch - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: -2 }];
        }
        return [];
      },
    },
  ],
};
