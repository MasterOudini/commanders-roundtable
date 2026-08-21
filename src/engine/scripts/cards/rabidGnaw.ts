// `Rabid Gnaw` — "Target creature you control gets +1/+0 until end of
// turn. Then it deals damage equal to its power to target creature you
// don't control." The pump-then-one-way-bite: the biter's power is read
// AFTER its own pump. D236.

import { RABID_GNAW } from '../../../data/fixtures/engineCards';
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
  RABID_GNAW,
  "Target creature you control gets +1/+0 until end of turn. Then it deals damage equal to its power to target creature you don't control.",
);

export const RABID_GNAW_SCRIPT: CardScript = {
  oracleId: RABID_GNAW.oracleId,
  name: RABID_GNAW.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const a = obj.targets[0];
      const b = obj.targets[1];
      if (!a || a.kind !== 'card') return [];
      const cardA = ctx.state.cards[a.id];
      if (cardA?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: a.id, power: 1, toughness: 0 },
      ];
      if (b && b.kind === 'card' && ctx.state.cards[b.id]?.zone.kind === 'battlefield') {
        const da = ctx.derive(a.id);
        const power = (da.power ?? 0) + 1;
        if (power > 0) {
          events.push({
            t: 'DamageDealt',
            damages: [
              {
                source: a.id,
                target: { kind: 'card', id: b.id },
                amount: power,
                deathtouch: da.keywords.has('deathtouch'),
                lifelinkTo: da.keywords.has('lifelink') ? cardA.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: da.toxicAmount,
                applyAs:
                  da.keywords.has('infect') || da.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          });
        }
      }
      return events;
    },
  },
};
