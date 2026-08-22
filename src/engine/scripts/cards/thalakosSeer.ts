// `Thalakos Seer` — the LEAVES watcher (Nefarious Imp's shape, D228) behind a
// shadow keyword line the engine already enforces. "Leaves the battlefield" is
// wider than "dies": a bounce pays too, which is Brandywine Farmer's rule
// (D165). D258.

import { THALAKOS_SEER } from '../../../data/fixtures/engineCards';
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
  THALAKOS_SEER,
  'Shadow (This creature can block or be blocked by only creatures with shadow.)\nWhen this creature leaves the battlefield, draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const THALAKOS_SEER_SCRIPT: CardScript = {
  oracleId: THALAKOS_SEER.oracleId,
  name: THALAKOS_SEER.name,
  triggers: [
    {
      abilityId: 'leaves',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield',
        ),
      label: () => 'Thalakos Seer — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
