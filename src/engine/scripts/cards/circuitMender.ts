// `Circuit Mender` — "When this creature enters, you gain 2 life.\nWhen
// this creature leaves the battlefield, draw a card." A self entry gain and
// Thalakos Seer's looks-back LEAVES watcher (D258): wider than dies — a
// bounce or an exile pays too (Brandywine Farmer's rule, D165). D273.

import { CIRCUIT_MENDER } from '../../../data/fixtures/engineCards';
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
  CIRCUIT_MENDER,
  'When this creature enters, you gain 2 life.\nWhen this creature leaves the battlefield, draw a card.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const LEAVES = PRINTED.split('\n')[1] as string;

export const CIRCUIT_MENDER_SCRIPT: CardScript = {
  oracleId: CIRCUIT_MENDER.oracleId,
  name: CIRCUIT_MENDER.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Circuit Mender — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
    {
      abilityId: 'leaves',
      text: LEAVES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield',
        ),
      label: () => 'Circuit Mender — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
