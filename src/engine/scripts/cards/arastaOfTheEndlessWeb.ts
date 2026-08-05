// `Arasta of the Endless Web` — "Reach\nWhenever an opponent casts an instant
// or sorcery spell, create a 1/2 green Spider creature token with reach."
// Talrand's mirror: the OPPONENT'S cast, not yours — and the token goes to
// Arasta's controller, not the caster. M6.4d, D161.

import { ARASTA_OF_THE_ENDLESS_WEB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  ARASTA_OF_THE_ENDLESS_WEB,
  'Reach\nWhenever an opponent casts an instant or sorcery spell, create a 1/2 green Spider creature token with reach.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIDER = tokenRef('Spider|1/2|G|Creature|reach');

export const ARASTA_OF_THE_ENDLESS_WEB_SCRIPT: CardScript = {
  oracleId: ARASTA_OF_THE_ENDLESS_WEB.oracleId,
  name: ARASTA_OF_THE_ENDLESS_WEB.name,
  triggers: [
    {
      abilityId: 'opponent-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      // "an OPPONENT casts" — anyone who is not Arasta's controller.
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller === ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const types = faceOf(oc, ev.obj.faceIndex).typeLine.types;
        return types.includes('Instant') || types.includes('Sorcery');
      },
      label: () => 'Arasta of the Endless Web — create a 1/2 Spider with reach',
      // ⚠️ The token goes to ARASTA'S controller — `obj.controller` is the
      // ability's controller (captured at fire time), never the caster's.
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIDER.oracleId,
          printingId: SPIDER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
