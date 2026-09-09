// `Sokka, Tenacious Tactician` - a static anthem, a castNoncreature trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOKKA_TENACIOUS_TACTICIAN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(SOKKA_TENACIOUS_TACTICIAN, "Menace, prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nOther Allies you control have menace and prowess.\nWhenever you cast a noncreature spell, create a 1/1 white Ally creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Ally|1/1|W|Creature|");

export const SOKKA_TENACIOUS_TACTICIAN_SCRIPT: CardScript = {
  oracleId: SOKKA_TENACIOUS_TACTICIAN.oracleId,
  name: SOKKA_TENACIOUS_TACTICIAN.name,
  triggers: [
    {
      abilityId: 'castNoncreature-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Sokka, Tenacious Tactician - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Ally") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("menace");
        chars.keywords.add("prowess");
      },
    },
  ],
};
