// `Glóin, Dwarf Emissary` - a castSpell trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GL_IN_DWARF_EMISSARY } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(GL_IN_DWARF_EMISSARY, "Whenever you cast a historic spell, create a Treasure token. This ability triggers only once each turn. (Artifacts, legendaries, and Sagas are historic.)\n{T}, Sacrifice a Treasure: Goad target creature. (Until your next turn, that creature attacks each combat if able and attacks a player other than you if able.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Treasure|/||Artifact|");

const VOCAB_A0 = vocabularyEffects("Goad target creature.", GL_IN_DWARF_EMISSARY.name);
const VOCAB_T_A0 = vocabularyTargets("Goad target creature.");

export const GL_IN_DWARF_EMISSARY_SCRIPT: CardScript = {
  oracleId: GL_IN_DWARF_EMISSARY.oracleId,
  name: GL_IN_DWARF_EMISSARY.name,
  activated: [
    {
      ref: `${GL_IN_DWARF_EMISSARY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.types.includes('Artifact') || ctx.derive(ev.obj.card).typeLine.supertypes.includes('Legendary') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Saga')),
      label: () => "Glóin, Dwarf Emissary - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
