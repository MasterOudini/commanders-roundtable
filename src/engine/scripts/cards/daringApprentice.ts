// `Daring Apprentice` — "{T}, Sacrifice this creature: Counter target spell."
// The FIRST script COUNTERSPELL (D170): the def emits the same
// `SpellCountered` the effect vocabulary has used since D90, aimed by the
// staged target prompt at a STACK object. Only a SPELL is countered — an
// ability chit re-checked at resolution simply gets nothing, and a spell
// that already left the stack gets nothing (CR 608.2b).

import { DARING_APPRENTICE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DARING_APPRENTICE, '{T}, Sacrifice this creature: Counter target spell.');

export const DARING_APPRENTICE_SCRIPT: CardScript = {
  oracleId: DARING_APPRENTICE.oracleId,
  name: DARING_APPRENTICE.name,
  activated: [
    {
      ref: `${DARING_APPRENTICE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        // ⚠️ TWO events, the vocabulary's own pair: the stack OBJECT dies with
        // `SpellCountered`, and the CARD goes to its owner's graveyard through
        // `moveFromStack` — one alone leaves the card stranded in the stack
        // zone forever (found by this def's own first test run).
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
