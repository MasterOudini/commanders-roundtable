// `Kessig Flamebreather` - a castNoncreature trigger damageOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KESSIG_FLAMEBREATHER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody, ResolvedDamage } from '../../types/events';

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

const PRINTED = printed(KESSIG_FLAMEBREATHER, "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.");

export const KESSIG_FLAMEBREATHER_SCRIPT: CardScript = {
  oracleId: KESSIG_FLAMEBREATHER.oracleId,
  name: KESSIG_FLAMEBREATHER.name,
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Kessig Flamebreather - damageOpponents",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        const damages: ResolvedDamage[] = [];
        for (const pid of Object.keys(ctx.state.players)) {
          if (pid === obj.controller) continue;
          damages.push({ source: self, target: { kind: 'player' as const, id: pid }, amount: 1, deathtouch: d.keywords.has('deathtouch'), lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null, isCommanderDamage: false, viaTrample: 0, toxic: d.toxicAmount ?? 0, applyAs: infect ? ('poison' as const) : wither ? ('wither' as const) : ('normal' as const) });
        }
        return damages.length ? [{ t: 'DamageDealt', damages }] : [];
      },
    },
  ],
};
