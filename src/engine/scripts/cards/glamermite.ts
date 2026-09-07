// `Glamermite` - a etb trigger tapTarget, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLAMERMITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLAMERMITE, "Flash\nFlying\nWhen this creature enters, choose one —\n• Tap target creature.\n• Untap target creature.");
const LINES = PRINTED.split('\n');

const MODES_L2 = [
  { text: "Tap target creature.", targets: vocabularyTargets("Tap target creature.") },
  { text: "Untap target creature.", targets: vocabularyTargets("Untap target creature.") },
];

const VOCAB_L2_m1 = vocabularyEffects("Untap target creature.", GLAMERMITE.name);
const VOCAB_T_L2_m1 = vocabularyTargets("Untap target creature.");

export const GLAMERMITE_SCRIPT: CardScript = {
  oracleId: GLAMERMITE.oracleId,
  name: GLAMERMITE.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L2,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Glamermite - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
          return [{ t: 'PermanentsTapped', cards: [target.id] }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L2_m1, VOCAB_T_L2_m1);
        }
        return [];
      },
    },
  ],
};
