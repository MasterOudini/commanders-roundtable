// `Marker Beetles` — "When this creature dies, target creature gets +1/+1
// until end of turn.\n{2}, Sacrifice this creature: Draw a card." Festering
// Goblin's TARGETED dies watcher (looks back, aimed as the ability goes on
// the stack, D147) with a pump, and a self-sacrifice draw whose cost fires
// that very watcher — one activation is a card AND a pump. D277.

import { MARKER_BEETLES } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  MARKER_BEETLES,
  'When this creature dies, target creature gets +1/+1 until end of turn.\n{2}, Sacrifice this creature: Draw a card.',
);
const DIES = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const MARKER_BEETLES_SCRIPT: CardScript = {
  oracleId: MARKER_BEETLES.oracleId,
  name: MARKER_BEETLES.name,
  triggers: [
    {
      abilityId: 'dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(DIES),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Marker Beetles — target creature gets +1/+1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1, keywords: [] }];
      },
    },
  ],
  activated: [
    {
      ref: `${MARKER_BEETLES.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
