// `Pounce` — Prey Upon's exact printed text on a second oracle id: the
// fight, at instant speed. D234.

import { POUNCE } from '../../../data/fixtures/engineCards';
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
  POUNCE,
  "Target creature you control fights target creature you don't control. (Each deals damage equal to its power to the other.)",
);

export const POUNCE_SCRIPT: CardScript = {
  oracleId: POUNCE.oracleId,
  name: POUNCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const a = obj.targets[0];
      const b = obj.targets[1];
      if (!a || !b || a.kind !== 'card' || b.kind !== 'card') return [];
      const cardA = ctx.state.cards[a.id];
      const cardB = ctx.state.cards[b.id];
      if (cardA?.zone.kind !== 'battlefield' || cardB?.zone.kind !== 'battlefield') return [];
      const da = ctx.derive(a.id);
      const db = ctx.derive(b.id);
      const damages = [];
      if ((da.power ?? 0) > 0) {
        damages.push({
          source: a.id,
          target: { kind: 'card' as const, id: b.id },
          amount: da.power ?? 0,
          deathtouch: da.keywords.has('deathtouch'),
          lifelinkTo: da.keywords.has('lifelink') ? cardA.controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: da.toxicAmount,
          applyAs:
            da.keywords.has('infect') || da.keywords.has('wither')
              ? ('wither' as const)
              : ('normal' as const),
        });
      }
      if ((db.power ?? 0) > 0) {
        damages.push({
          source: b.id,
          target: { kind: 'card' as const, id: a.id },
          amount: db.power ?? 0,
          deathtouch: db.keywords.has('deathtouch'),
          lifelinkTo: db.keywords.has('lifelink') ? cardB.controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: db.toxicAmount,
          applyAs:
            db.keywords.has('infect') || db.keywords.has('wither')
              ? ('wither' as const)
              : ('normal' as const),
        });
      }
      return damages.length > 0 ? [{ t: 'DamageDealt', damages }] : [];
    },
  },
};
