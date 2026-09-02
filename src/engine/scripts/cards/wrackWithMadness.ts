// `Wrack with Madness` — "Target creature deals damage to itself equal to its
// power." The source and the target are the SAME card, which is the whole
// shape: a 0-power creature deals nothing, and the creature's own keywords
// (deathtouch, wither, infect) apply because it is genuinely the source.
//
// ⚠️ Batch-mate `Wisecrack` is this line plus an attacking rider; the two
// share this body. D270.

import { WRACK_WITH_MADNESS } from '../../../data/fixtures/engineCards';
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
  WRACK_WITH_MADNESS,
  'Target creature deals damage to itself equal to its power.',
);

export const WRACK_WITH_MADNESS_SCRIPT: CardScript = {
  oracleId: WRACK_WITH_MADNESS.oracleId,
  name: WRACK_WITH_MADNESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];

      const d = ctx.derive(target.id);
      const power = d.power ?? 0;
      if (power <= 0) return [];

      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              // ⚠️ The creature is its OWN source, so its keywords apply.
              source: target.id,
              target: { kind: 'card', id: target.id },
              amount: power,
              deathtouch: d.keywords.has('deathtouch'),
              lifelinkTo: d.keywords.has('lifelink') ? card.controller : null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs:
                d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
            },
          ],
        },
      ];
    },
  },
};
