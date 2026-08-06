// `Deepwood Tantiv` — "Whenever this creature becomes blocked, you gain 2
// life." The FIRST becomes-blocked watcher (D171): the bus dispatches on
// `AttackerBecameBlocked`, the event the block declaration has emitted since
// M3 — self-filtered, so per-event firing is per-instance (the
// granularity-safe shape). CR 509.1g: it fires ONCE however many blockers
// pile on. M6.4o, D171.

import { DEEPWOOD_TANTIV } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEEPWOOD_TANTIV, 'Whenever this creature becomes blocked, you gain 2 life.');

export const DEEPWOOD_TANTIV_SCRIPT: CardScript = {
  oracleId: DEEPWOOD_TANTIV.oracleId,
  name: DEEPWOOD_TANTIV.name,
  triggers: [
    {
      abilityId: 'blocked',
      text: TEXT,
      event: 'AttackerBecameBlocked',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackerBecameBlocked' && ev.attackers.includes(self),
      label: () => 'Deepwood Tantiv — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
