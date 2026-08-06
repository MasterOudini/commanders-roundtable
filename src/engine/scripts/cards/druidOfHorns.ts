// `Druid of Horns` — "Whenever you cast an Aura spell that targets this
// creature, create a 3/3 green Beast creature token." The FIRST cast-watcher
// that reads the SPELL'S CHOSEN TARGETS (D172): `SpellCast` carries the stack
// object, whose `targets` are the aims the caster declared — so "that targets
// this creature" is a filter over the event, not a new seam. M6.4p, D172.

import { DRUID_OF_HORNS } from '../../../data/fixtures/engineCards';
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
  DRUID_OF_HORNS,
  'Whenever you cast an Aura spell that targets this creature, create a 3/3 green Beast creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BEAST = tokenRef('Beast|3/3|G|Creature|');

export const DRUID_OF_HORNS_SCRIPT: CardScript = {
  oracleId: DRUID_OF_HORNS.oracleId,
  name: DRUID_OF_HORNS.name,
  triggers: [
    {
      abilityId: 'aura-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.targets.some((t) => t.kind === 'card' && t.id === self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).typeLine.subtypes.includes('Aura');
      },
      label: () => 'Druid of Horns — create a 3/3 Beast',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BEAST.oracleId,
          printingId: BEAST.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
