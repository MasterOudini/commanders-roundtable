// `Overwhelming Intellect` — "Counter target creature spell. Draw cards
// equal to that spell's mana value." The typed-spell aim (PROBED
// confident, cardTypes enforced), Daring Apprentice's counter pair, and
// Dispersal Shield's mana-value read — X included. D231.

import { OVERWHELMING_INTELLECT } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import { drawEvents, moveFromStack } from '../../effects';
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
  OVERWHELMING_INTELLECT,
  "Counter target creature spell. Draw cards equal to that spell's mana value.",
);

export const OVERWHELMING_INTELLECT_SCRIPT: CardScript = {
  oracleId: OVERWHELMING_INTELLECT.oracleId,
  name: OVERWHELMING_INTELLECT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
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
      const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      }
      const player = ctx.state.players[obj.controller];
      if (mv > 0 && player && !player.hasLost) {
        out.push(...drawEvents(ctx.state, obj.controller, mv));
      }
      return out;
    },
  },
};
