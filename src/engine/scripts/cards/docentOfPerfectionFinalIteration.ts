// `Docent of Perfection // Final Iteration` - a castInstantSorcery trigger vocab, a static anthem, a castInstantSorcery trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOCENT_OF_PERFECTION_FINAL_ITERATION } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
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

const PRINTED = printed(DOCENT_OF_PERFECTION_FINAL_ITERATION, "Flying\nWhenever you cast an instant or sorcery spell, create a 1/1 blue Human Wizard creature token. Then if you control three or more Wizards, transform this creature.\nFlying\nWizards you control get +2/+1 and have flying.\nWhenever you cast an instant or sorcery spell, create a 1/1 blue Human Wizard creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L4 = tokenRef("Human Wizard|1/1|U|Creature|");

const VOCAB_L1 = transformFrom(vocabularyEffects("Create a 1/1 blue Human Wizard creature token. Then if you control three or more Wizards, transform this creature.", DOCENT_OF_PERFECTION_FINAL_ITERATION.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 blue Human Wizard creature token. Then if you control three or more Wizards, transform this creature.");

export const DOCENT_OF_PERFECTION_FINAL_ITERATION_SCRIPT: CardScript = {
  oracleId: DOCENT_OF_PERFECTION_FINAL_ITERATION.oracleId,
  name: DOCENT_OF_PERFECTION_FINAL_ITERATION.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1', face: 0,
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Docent of Perfection // Final Iteration - Create a 1/1 blue Human Wizard creature token. Then if you control three or more Wizards, transform this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'castInstantSorcery-4', face: 1,
      text: LINES[4] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Docent of Perfection // Final Iteration - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L4.oracleId,
          printingId: TOKEN_L4.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-3', face: 1,
      text: LINES[3] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Wizard") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'anthem-grant-3', face: 1,
      text: LINES[3] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Wizard") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
