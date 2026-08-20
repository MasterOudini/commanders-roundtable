// `Epic Confrontation` — "Target creature you control gets +1/+2 until end
// of turn. It fights target creature you don't control." The pump lands
// first and the fight reads MY side's power AFTER it — a KNOWN +1 over the
// derived value (Ambuscade's arithmetic on a two-way fight). D211.

import { EPIC_CONFRONTATION } from '../../../data/fixtures/engineCards';
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
  EPIC_CONFRONTATION,
  "Target creature you control gets +1/+2 until end of turn. It fights target creature you don't control. (Each deals damage equal to its power to the other.)",
);

export const EPIC_CONFRONTATION_SCRIPT: CardScript = {
  oracleId: EPIC_CONFRONTATION.oracleId,
  name: EPIC_CONFRONTATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const a = obj.targets[0];
      const b = obj.targets[1];
      if (!a || a.kind !== 'card') return [];
      const cardA = ctx.state.cards[a.id];
      if (cardA?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: a.id, power: 1, toughness: 2 },
      ];
      if (!b || b.kind !== 'card') return events;
      const cardB = ctx.state.cards[b.id];
      if (cardB?.zone.kind !== 'battlefield') return events;
      const da = ctx.derive(a.id);
      const db = ctx.derive(b.id);
      const damages = [];
      const aPower = (da.power ?? 0) + 1;
      if (aPower > 0) {
        damages.push({
          source: a.id,
          target: { kind: 'card' as const, id: b.id },
          amount: aPower,
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
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
