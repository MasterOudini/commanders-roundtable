// `Mardu Shadowspear` - a attacks trigger loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARDU_SHADOWSPEAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARDU_SHADOWSPEAR, "Whenever this creature attacks, each opponent loses 1 life.\nDash {1}{B} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

export const MARDU_SHADOWSPEAR_SCRIPT: CardScript = {
  oracleId: MARDU_SHADOWSPEAR.oracleId,
  name: MARDU_SHADOWSPEAR.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Mardu Shadowspear - loseLifeOpponents",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
};
