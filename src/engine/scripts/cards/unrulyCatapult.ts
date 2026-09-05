// `Unruly Catapult` - an activation damageOpponents, a castInstantSorcery trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNRULY_CATAPULT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNRULY_CATAPULT, "Defender\n{T}: This creature deals 1 damage to each opponent.\nWhenever you cast an instant or sorcery spell, untap this creature.");
const LINES = PRINTED.split('\n');

export const UNRULY_CATAPULT_SCRIPT: CardScript = {
  oracleId: UNRULY_CATAPULT.oracleId,
  name: UNRULY_CATAPULT.name,
  activated: [
    {
      ref: `${UNRULY_CATAPULT.oracleId}#a0`,
      text: LINES[1] as string,
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
  triggers: [
    {
      abilityId: 'castInstantSorcery-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Unruly Catapult - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
