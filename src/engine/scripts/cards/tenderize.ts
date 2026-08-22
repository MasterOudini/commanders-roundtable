// `Tenderize` — the two-controller bite, third card in the class.
//
// ⚠️ D255's rule, applied from the first draft for the third time: the two
// targets are identified BY CONTROLLER, never by index. `assignTargets` is a
// one-for-one matching (D102) that proves a legal assignment exists WITHOUT
// reordering the answer, so `obj.targets[0]` is simply whatever the player
// listed first. Swift Kick (D255) and Tail Slash (D256) both measured the
// same thing: a swapped answer is accepted at the aim and then does nothing.
//
// The spec pair here is 'you control' + 'an opponent controls' rather than
// 'you don't control' — D236's Public Execution proved the opponent
// restriction is ENFORCED, so the aim narrows it for us. D258.

import { TENDERIZE } from '../../../data/fixtures/engineCards';
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
  TENDERIZE,
  'Target creature you control deals damage equal to its power to target creature an opponent controls.',
);

export const TENDERIZE_SCRIPT: CardScript = {
  oracleId: TENDERIZE.oracleId,
  name: TENDERIZE.name,
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
