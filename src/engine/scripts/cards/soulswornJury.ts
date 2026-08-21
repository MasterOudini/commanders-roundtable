// `Soulsworn Jury` — "{1}{U}, Sacrifice this creature: Counter target
// creature spell." Daring Apprentice's two-event counter behind a self-sac
// cost, with the PROBED typed-spell aim (cardTypes enforced). The defender
// line is Tier 2 and never counts. D250.

import { SOULSWORN_JURY } from '../../../data/fixtures/engineCards';
import { moveFromStack } from '../../effects';
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

const PRINTED = printed(
  SOULSWORN_JURY,
  "Defender (This creature can't attack.)\n{1}{U}, Sacrifice this creature: Counter target creature spell.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SOULSWORN_JURY_SCRIPT: CardScript = {
  oracleId: SOULSWORN_JURY.oracleId,
  name: SOULSWORN_JURY.name,
  activated: [
    {
      ref: `${SOULSWORN_JURY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
        if (spell.card) {
          const vc = ctx.state.cards[spell.card];
          if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
        }
        return out;
      },
    },
  ],
};
