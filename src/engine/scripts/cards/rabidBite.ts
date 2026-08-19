// `Rabid Bite` — "Target creature you control deals damage equal to its
// power to target creature you don't control." The ONE-SIDED fight: only
// the biter deals. CR 701.12b's shape still applies through the target
// re-check — if either creature is gone, nothing happens (a bite from a
// dead creature reads its power off a corpse). The biter's riders ride,
// which is the whole reason green decks point deathtouch through it. D192.

import { RABID_BITE } from '../../../data/fixtures/engineCards';
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
  RABID_BITE,
  "Target creature you control deals damage equal to its power to target creature you don't control.",
);

export const RABID_BITE_SCRIPT: CardScript = {
  oracleId: RABID_BITE.oracleId,
  name: RABID_BITE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const biter = obj.targets[0];
      const bitten = obj.targets[1];
      if (!biter || !bitten || biter.kind !== 'card' || bitten.kind !== 'card') return [];
      if (ctx.state.cards[biter.id]?.zone.kind !== 'battlefield') return [];
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
              lifelinkTo: d.keywords.has('lifelink')
                ? (ctx.state.cards[biter.id]?.controller ?? null)
                : null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: d.toxicAmount,
              applyAs:
                d.keywords.has('infect') || d.keywords.has('wither')
                  ? 'wither'
                  : 'normal',
            },
          ],
        },
      ];
    },
  },
};
