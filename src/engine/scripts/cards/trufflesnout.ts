// `Trufflesnout` - a etb trigger selfCounter, a etb trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUFFLESNOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRUFFLESNOUT, "When this creature enters, choose one —\n• Put a +1/+1 counter on this creature.\n• You gain 4 life.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Put a +1/+1 counter on this creature.", targets: vocabularyTargets("Put a +1/+1 counter on ~.") },
  { text: "You gain 4 life.", targets: vocabularyTargets("You gain 4 life.") },
];

export const TRUFFLESNOUT_SCRIPT: CardScript = {
  oracleId: TRUFFLESNOUT.oracleId,
  name: TRUFFLESNOUT.name,
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
      label: () => "Trufflesnout - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 1) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
        }
        return [];
      },
    },
  ],
};
