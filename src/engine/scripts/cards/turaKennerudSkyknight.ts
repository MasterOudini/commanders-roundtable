// `Tura Kennerüd, Skyknight` — flying plus an instant-or-sorcery cast watcher
// paying a Soldier: Murmuring Mystic's shape (D227), which is Talrand's with
// a different token. The keyword line never counts, so the def's text is
// `split[1]`.
//
// ⚠️ The fixture const strips the diacritic to an UNDERSCORE — D222's
// Lothlórien rule and D259's Théoden, both of which the recipe guessed wrong
// before the fixture rebuild settled it. D262.

import { TURA_KENNER_D_SKYKNIGHT } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { faceOf } from '../../oracle';
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
  TURA_KENNER_D_SKYKNIGHT,
  'Flying\nWhenever you cast an instant or sorcery spell, create a 1/1 white Soldier creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

const SOLDIER = tokenRef('Soldier|1/1|W|Creature|');

export const TURA_KENNERUD_SKYKNIGHT_SCRIPT: CardScript = {
  oracleId: TURA_KENNER_D_SKYKNIGHT.oracleId,
  name: TURA_KENNER_D_SKYKNIGHT.name,
  triggers: [
    {
      abilityId: 'spell-cast',
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
      label: () => 'Tura Kennerüd, Skyknight — create a 1/1 Soldier',
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
