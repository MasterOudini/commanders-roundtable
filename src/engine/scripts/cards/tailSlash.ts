// `Tail Slash` — Soul's Fire's bite with BOTH controllers enforced.
//
// ⚠️ D255's lesson applied from the first draft: the two targets are
// identified BY CONTROLLER, never by index. `assignTargets` is a
// one-for-one matching that proves a legal assignment exists without
// reordering the answer, so `obj.targets[0]` is simply whatever the
// player listed first. D256.

import { TAIL_SLASH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  TAIL_SLASH,
  "Target creature you control deals damage equal to its power to target creature you don't control.",
);

export const TAIL_SLASH_SCRIPT: CardScript = {
  oracleId: TAIL_SLASH.oracleId,
  name: TAIL_SLASH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let mine: InstanceId | null = null;
      let theirs: InstanceId | null = null;
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.controller === obj.controller) mine ??= target.id;
        else theirs ??= target.id;
      }
      if (mine === null || theirs === null) return [];
      const d = ctx.derive(mine);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: mine,
              target: { kind: 'card', id: theirs },
              amount: power,
              deathtouch: d.keywords.has('deathtouch'),
              lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
            },
          ],
        },
      ];
    },
  },
};
