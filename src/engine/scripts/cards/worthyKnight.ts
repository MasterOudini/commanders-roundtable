// `Worthy Knight` — "Whenever you cast a Knight spell, create a 1/1 white
// Human creature token." Insight's cast watcher (D269's Whirlwind of Thought
// one predicate over): the SUBTYPE is read off the cast FACE, not off the
// permanent, because the spell is still on the stack when this fires. D270.

import { WORTHY_KNIGHT } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  WORTHY_KNIGHT,
  'Whenever you cast a Knight spell, create a 1/1 white Human creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN = tokenRef('Human|1/1|W|Creature|');

export const WORTHY_KNIGHT_SCRIPT: CardScript = {
  oracleId: WORTHY_KNIGHT.oracleId,
  name: WORTHY_KNIGHT.name,
  triggers: [
    {
      abilityId: 'knight-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        // "YOU cast" — mine only.
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).typeLine.subtypes.includes('Knight');
      },
      label: () => 'Worthy Knight — create a 1/1 white Human creature token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: HUMAN.oracleId,
          printingId: HUMAN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
