// `Tectonic Hazard` — 1 damage to each opponent AND each creature they
// control, in one simultaneous fan. Flame Wave's shape (D213) widened from
// one player to every opponent. D257.

import { TECTONIC_HAZARD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  TECTONIC_HAZARD,
  'Tectonic Hazard deals 1 damage to each opponent and each creature they control.',
);

export const TECTONIC_HAZARD_SCRIPT: CardScript = {
  oracleId: TECTONIC_HAZARD.oracleId,
  name: TECTONIC_HAZARD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const hit = (target: { kind: 'card'; id: string } | { kind: 'player'; id: string }) => ({
        source: self,
        target,
        amount: 1,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const opponents = new Set<string>();
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        opponents.add(pid);
      }
      if (opponents.size === 0) return [];
      const damages = [...opponents].map((pid) => hit({ kind: 'player', id: pid }));
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || !opponents.has(inst.controller)) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push(hit({ kind: 'card', id }));
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
