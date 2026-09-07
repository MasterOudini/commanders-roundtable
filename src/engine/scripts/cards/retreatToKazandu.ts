// `Retreat to Kazandu` - a landfall trigger counterOnTarget, a landfall trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RETREAT_TO_KAZANDU } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RETREAT_TO_KAZANDU, "Landfall — Whenever a land you control enters, choose one —\n• Put a +1/+1 counter on target creature.\n• You gain 2 life.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Put a +1/+1 counter on target creature.", targets: vocabularyTargets("Put a +1/+1 counter on target creature.") },
  { text: "You gain 2 life.", targets: vocabularyTargets("You gain 2 life.") },
];

export const RETREAT_TO_KAZANDU_SCRIPT: CardScript = {
  oracleId: RETREAT_TO_KAZANDU.oracleId,
  name: RETREAT_TO_KAZANDU.name,
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
      label: () => "Retreat to Kazandu - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 1) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
        }
        return [];
      },
    },
  ],
};
