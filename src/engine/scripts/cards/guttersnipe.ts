// `Guttersnipe` - a castInstantSorcery trigger damageOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GUTTERSNIPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GUTTERSNIPE, "Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent.");

export const GUTTERSNIPE_SCRIPT: CardScript = {
  oracleId: GUTTERSNIPE.oracleId,
  name: GUTTERSNIPE.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Guttersnipe - damageOpponents",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        const damages: ResolvedDamage[] = [];
        for (const pid of Object.keys(ctx.state.players)) {
          if (pid === obj.controller) continue;
          damages.push({ source: self, target: { kind: 'player' as const, id: pid }, amount: 2, deathtouch: d.keywords.has('deathtouch'), lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null, isCommanderDamage: false, viaTrample: 0, toxic: d.toxicAmount ?? 0, applyAs: infect ? ('poison' as const) : wither ? ('wither' as const) : ('normal' as const) });
        }
        return damages.length ? [{ t: 'DamageDealt', damages }] : [];
      },
    },
  ],
};
