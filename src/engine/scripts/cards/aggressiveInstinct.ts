// `Aggressive Instinct` — Rabid Bite's exact text on its own oracle id:
// the one-sided fight, biter's riders riding. D197.

import { AGGRESSIVE_INSTINCT } from '../../../data/fixtures/engineCards';
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
  AGGRESSIVE_INSTINCT,
  "Target creature you control deals damage equal to its power to target creature you don't control.",
);

export const AGGRESSIVE_INSTINCT_SCRIPT: CardScript = {
  oracleId: AGGRESSIVE_INSTINCT.oracleId,
  name: AGGRESSIVE_INSTINCT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const biter = obj.targets[0];
      const bitten = obj.targets[1];
      if (!biter || !bitten || biter.kind !== 'card' || bitten.kind !== 'card') return [];
      const source = ctx.state.cards[biter.id];
      if (source?.zone.kind !== 'battlefield') return [];
      if (ctx.state.cards[bitten.id]?.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(biter.id);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: biter.id,
              target: { kind: 'card', id: bitten.id },
              amount: power,
              deathtouch: d.keywords.has('deathtouch'),
              lifelinkTo: d.keywords.has('lifelink') ? source.controller : null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: d.toxicAmount,
              applyAs:
                d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
            },
          ],
        },
      ];
    },
  },
};
