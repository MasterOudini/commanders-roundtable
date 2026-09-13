// `Equilibrium Adept` - a etb trigger vocab, a secondSpell trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EQUILIBRIUM_ADEPT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EQUILIBRIUM_ADEPT, "When this creature enters, exile the top card of your library. Until the end of your next turn, you may play that card.\nFlurry — Whenever you cast your second spell each turn, this creature gains double strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", EQUILIBRIUM_ADEPT.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const EQUILIBRIUM_ADEPT_SCRIPT: CardScript = {
  oracleId: EQUILIBRIUM_ADEPT.oracleId,
  name: EQUILIBRIUM_ADEPT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Equilibrium Adept - Exile the top card of your library. Until the end of your next turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Equilibrium Adept - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["doubleStrike"] }];
      },
    },
  ],
};
