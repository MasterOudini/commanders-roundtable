// `Rocky Rebuke` — "Target creature you control deals damage equal to
// its power to target creature an opponent controls." Bite Down's
// one-way bite with the opponent-controller spec — PROBED: both specs
// parse confident with both controllers ENFORCED. D241.

import { ROCKY_REBUKE } from '../../../data/fixtures/engineCards';
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
  ROCKY_REBUKE,
  'Target creature you control deals damage equal to its power to target creature an opponent controls.',
);

export const ROCKY_REBUKE_SCRIPT: CardScript = {
  oracleId: ROCKY_REBUKE.oracleId,
  name: ROCKY_REBUKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const mine = obj.targets[0];
      const theirs = obj.targets[1];
      if (!mine || mine.kind !== 'card') return [];
      const source = ctx.state.cards[mine.id];
      if (source?.zone.kind !== 'battlefield') return [];
      if (!theirs || theirs.kind !== 'card') return [];
      if (ctx.state.cards[theirs.id]?.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(mine.id);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: mine.id,
              target: { kind: 'card', id: theirs.id },
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
