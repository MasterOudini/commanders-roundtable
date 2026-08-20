// `Parallectric Feedback` — "Parallectric Feedback deals damage to target
// spell's controller equal to that spell's mana value." The stack aim
// (PROBED confident) burning the CASTER for Dispersal Shield's mana-value
// read — chosen X included; the spell itself stays on the stack. D231.

import { PARALLECTRIC_FEEDBACK } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  PARALLECTRIC_FEEDBACK,
  "Parallectric Feedback deals damage to target spell's controller equal to that spell's mana value.",
);

export const PARALLECTRIC_FEEDBACK_SCRIPT: CardScript = {
  oracleId: PARALLECTRIC_FEEDBACK.oracleId,
  name: PARALLECTRIC_FEEDBACK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      let mv = 0;
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        const oc = vc && ctx.oracle.byPrinting(vc.printingId);
        if (oc) {
          mv =
            (oc.manaValue ?? 0) +
            (faceOf(oc, vc.faceIndex ?? 0).manaCost?.xCount ?? 0) * (spell.xValue ?? 0);
        }
      }
      if (mv === 0) return [];
      const p = ctx.state.players[spell.controller];
      if (!p || p.hasLost) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: spell.controller },
              amount: mv,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
    },
  },
};
