// `Zuko, Avatar Hunter` — reach plus "Whenever you cast a red spell, create a
// 2/2 red Soldier creature token." Insight's cast watcher on MY casts, colour
// read DERIVED off the cast face. The keyword line never counts, so the def's
// text is `split[1]`. The 2/2 R Soldier is one of this batch's four NEW pins
// (ttle 2): WANTED already held FOUR other Soldiers, none this printing.
// D271.

import { ZUKO_AVATAR_HUNTER } from '../../../data/fixtures/engineCards';
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
  ZUKO_AVATAR_HUNTER,
  'Reach (This creature can block creatures with flying.)\nWhenever you cast a red spell, create a 2/2 red Soldier creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|2/2|R|Creature|');

export const ZUKO_AVATAR_HUNTER_SCRIPT: CardScript = {
  oracleId: ZUKO_AVATAR_HUNTER.oracleId,
  name: ZUKO_AVATAR_HUNTER.name,
  triggers: [
    {
      abilityId: 'red-cast-soldier',
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
        return faceOf(oc, ev.obj.faceIndex).colors.includes('R');
      },
      label: () => 'Zuko, Avatar Hunter — create a 2/2 red Soldier creature token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
