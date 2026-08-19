// `Chandra's Ignition` — "Target creature you control deals damage equal to
// its power to each other creature and each opponent." The first AoE dealt
// BY a chosen permanent: one source, N entries, all in ONE DamageDealt so
// the burn is simultaneous. The source's riders ride every entry — a
// lifelink source pays its controller once per entry, deathtouch makes
// every creature hit lethal, infect splits poison (players) from wither
// (creatures) exactly as combat does (CR 702.90b/c, D174's lesson). "Each
// opponent" is every other player still in the game — the caster and the
// source's own entry are excluded by the card's own words. D192.

import { CHANDRA_S_IGNITION } from '../../../data/fixtures/engineCards';
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
  CHANDRA_S_IGNITION,
  'Target creature you control deals damage equal to its power to each other creature and each opponent.',
);

export const CHANDRAS_IGNITION_SCRIPT: CardScript = {
  oracleId: CHANDRA_S_IGNITION.oracleId,
  name: CHANDRA_S_IGNITION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const source = ctx.state.cards[target.id];
      if (source?.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      const rider = {
        deathtouch: d.keywords.has('deathtouch'),
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: d.toxicAmount,
      };
      const lifelinkTo = d.keywords.has('lifelink') ? source.controller : null;
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push({
          ...rider,
          source: target.id,
          target: { kind: 'card' as const, id },
          amount: power,
          lifelinkTo,
          applyAs:
            d.keywords.has('infect') || d.keywords.has('wither')
              ? ('wither' as const)
              : ('normal' as const),
        });
      }
      for (const [pid, p] of Object.entries(ctx.state.players)) {
        if (pid === obj.controller || p.hasLost) continue;
        damages.push({
          ...rider,
          source: target.id,
          target: { kind: 'player' as const, id: pid },
          amount: power,
          lifelinkTo,
          applyAs: d.keywords.has('infect') ? ('poison' as const) : ('normal' as const),
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
