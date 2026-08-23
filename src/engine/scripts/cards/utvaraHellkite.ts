// `Utvara Hellkite` — a FILTERED perItem fan-out (D190) on the attack
// declaration: "whenever a DRAGON YOU CONTROL attacks" fires once per
// attacking Dragon of mine, so the item list is the attackers filtered rather
// than all of them (Righteous Cause D240 is the unfiltered precedent).
//
// ⚠️ The Hellkite itself is a Dragon, so its own attack pays — and two
// attacking Dragons make TWO tokens, which is what the fan-out is for and
// what a single-firing def would get wrong on exactly this board. D265.

import { UTVARA_HELLKITE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  UTVARA_HELLKITE,
  'Flying\nWhenever a Dragon you control attacks, create a 6/6 red Dragon creature token with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

const DRAGON = tokenRef('Dragon|6/6|R|Creature|flying');

export const UTVARA_HELLKITE_SCRIPT: CardScript = {
  oracleId: UTVARA_HELLKITE.oracleId,
  name: UTVARA_HELLKITE.name,
  triggers: [
    {
      abilityId: 'dragon-attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.attackers.some((a) => {
          const inst = ctx.state.cards[a.card];
          if (!inst || inst.controller !== mine) return false;
          return ctx.derive(a.card).typeLine.subtypes.includes('Dragon');
        });
      },
      // One firing per attacking Dragon OF MINE.
      perItem: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return [];
        const mine = ctx.query.controllerOf(self);
        return ev.attackers
          .filter((a) => {
            const inst = ctx.state.cards[a.card];
            if (!inst || inst.controller !== mine) return false;
            return ctx.derive(a.card).typeLine.subtypes.includes('Dragon');
          })
          .map((a) => a.card);
      },
      label: () => 'Utvara Hellkite — create a 6/6 Dragon with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DRAGON.oracleId,
          printingId: DRAGON.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
