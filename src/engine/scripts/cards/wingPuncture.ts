// `Wing Puncture` — Tail Slash's bite where the bitten creature must FLY.
// The flying restriction is the parser's and the validator's (D289); this
// resolve identifies the two roles by what each target IS — mine for the
// first clause, a flyer for the second — never by index (D255). When both
// readings fit (two flyers of mine), the submitted order decides, which is
// the assignment the validator found.

import { WING_PUNCTURE } from '../../../data/fixtures/engineCards';
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
  WING_PUNCTURE,
  'Target creature you control deals damage equal to its power to target creature with flying.',
);

export const WING_PUNCTURE_SCRIPT: CardScript = {
  oracleId: WING_PUNCTURE.oracleId,
  name: WING_PUNCTURE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const ids: InstanceId[] = [];
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        ids.push(target.id);
      }
      const [a, b] = ids;
      if (a === undefined || b === undefined || a === b) return [];
      const isMine = (id: InstanceId): boolean => ctx.state.cards[id]?.controller === obj.controller;
      const flies = (id: InstanceId): boolean => ctx.derive(id).keywords.has('flying');
      let mine: InstanceId;
      let flyer: InstanceId;
      if (isMine(a) && flies(b)) {
        mine = a;
        flyer = b;
      } else if (isMine(b) && flies(a)) {
        mine = b;
        flyer = a;
      } else {
        return [];
      }
      const d = ctx.derive(mine);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: mine,
              target: { kind: 'card', id: flyer },
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
