// `Essence Backlash` — "Counter target creature spell. Essence Backlash
// deals damage equal to that spell's power to its controller." The power
// is the CAST FACE's printed power (a spell on the stack has no
// derivation), the burn goes to the spell's controller, and both halves
// run even against a 0-power spell (a counter, then nothing). D211.

import { ESSENCE_BACKLASH } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const TEXT = printed(
  ESSENCE_BACKLASH,
  "Counter target creature spell. Essence Backlash deals damage equal to that spell's power to its controller.",
);

export const ESSENCE_BACKLASH_SCRIPT: CardScript = {
  oracleId: ESSENCE_BACKLASH.oracleId,
  name: ESSENCE_BACKLASH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const vc = spell.card ? ctx.state.cards[spell.card] : null;
      const oc = vc && ctx.oracle.byPrinting(vc.printingId);
      const power = oc ? (faceOf(oc, vc.faceIndex ?? 0).basePower ?? 0) : 0;
      const controller = spell.controller;
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card && vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      if (power > 0 && !ctx.state.players[controller]?.hasLost) {
        out.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: controller },
              amount: power,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return out;
    },
  },
};
