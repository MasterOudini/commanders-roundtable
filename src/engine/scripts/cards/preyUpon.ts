// `Prey Upon` — "Target creature you control fights target creature you
// don't control." The first FIGHT (CR 701.12): each deals damage equal to
// its power to the other, simultaneously, in ONE DamageDealt. If EITHER
// creature has left the battlefield by resolution, neither deals damage
// (CR 701.12b) — not half a fight. Each entry carries ITS source's riders
// (deathtouch is why Fight decks run deathtouch), the Kamahl idiom per
// side. D192.

import { PREY_UPON } from '../../../data/fixtures/engineCards';
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
  PREY_UPON,
  "Target creature you control fights target creature you don't control. (Each deals damage equal to its power to the other.)",
);

export const PREY_UPON_SCRIPT: CardScript = {
  oracleId: PREY_UPON.oracleId,
  name: PREY_UPON.name,
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
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
