// `Sabotender` - a landfall trigger damageOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SABOTENDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SABOTENDER, "Reach\nLandfall — Whenever a land you control enters, this creature deals 1 damage to each opponent.");
const LINES = PRINTED.split('\n');

export const SABOTENDER_SCRIPT: CardScript = {
  oracleId: SABOTENDER.oracleId,
  name: SABOTENDER.name,
  triggers: [
    {
      abilityId: 'landfall-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Sabotender - damageOpponents",
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
