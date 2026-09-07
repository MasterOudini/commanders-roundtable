// `Graviton, Fundamental Force` - a secondCard trigger pumpTarget, a secondCard trigger tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAVITON_FUNDAMENTAL_FORCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAVITON_FUNDAMENTAL_FORCE, "Whenever you draw your second card each turn, choose one —\n• Target creature gains flying until end of turn. (It can't be blocked except by creatures with flying or reach.)\n• Tap target creature.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Target creature gains flying until end of turn.", targets: vocabularyTargets("Target creature gains flying until end of turn.") },
  { text: "Tap target creature.", targets: vocabularyTargets("Tap target creature.") },
];

export const GRAVITON_FUNDAMENTAL_FORCE_SCRIPT: CardScript = {
  oracleId: GRAVITON_FUNDAMENTAL_FORCE.oracleId,
  name: GRAVITON_FUNDAMENTAL_FORCE.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: LINES[0] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Graviton, Fundamental Force - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["flying"] }];
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
          return [{ t: 'PermanentsTapped', cards: [target.id] }];
        }
        return [];
      },
    },
  ],
};
