// `Aven Surveyor` - a etb trigger selfCounter, a etb trigger bounceTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVEN_SURVEYOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_SURVEYOR, "Flying\nWhen this creature enters, choose one —\n• Put a +1/+1 counter on this creature.\n• Return target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const MODES_L1 = [
  { text: "Put a +1/+1 counter on this creature.", targets: vocabularyTargets("Put a +1/+1 counter on ~.") },
  { text: "Return target creature to its owner's hand.", targets: vocabularyTargets("Return target creature to its owner's hand.") },
];

export const AVEN_SURVEYOR_SCRIPT: CardScript = {
  oracleId: AVEN_SURVEYOR.oracleId,
  name: AVEN_SURVEYOR.name,
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
      label: () => "Aven Surveyor - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'hand', player: card.owner } }] }];
        }
        return [];
      },
    },
  ],
};
