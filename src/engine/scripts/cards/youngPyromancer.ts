// `Young Pyromancer` — "Whenever you cast an instant or sorcery spell, create
// a 1/1 red Elemental creature token." Worthy Knight's cast watcher (D270)
// with a TYPE test instead of a subtype, read off the cast FACE because the
// spell is on the stack when this fires. The mono-red 1/1 Elemental is one of
// this batch's four NEW pins (tm20 7) — WANTED already held two OTHER
// Elementals, which is exactly the name-collision D268 warned about. D271.

import { YOUNG_PYROMANCER } from '../../../data/fixtures/engineCards';
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
  YOUNG_PYROMANCER,
  'Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ELEMENTAL = tokenRef('Elemental|1/1|R|Creature|');

export const YOUNG_PYROMANCER_SCRIPT: CardScript = {
  oracleId: YOUNG_PYROMANCER.oracleId,
  name: YOUNG_PYROMANCER.name,
  triggers: [
    {
      abilityId: 'instant-sorcery-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const types = faceOf(oc, ev.obj.faceIndex).typeLine.types;
        return types.includes('Instant') || types.includes('Sorcery');
      },
      label: () => 'Young Pyromancer — create a 1/1 red Elemental creature token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ELEMENTAL.oracleId,
          printingId: ELEMENTAL.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
