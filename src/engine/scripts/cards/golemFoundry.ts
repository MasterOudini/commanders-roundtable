// `Golem Foundry` - a castArtifactSpell trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOLEM_FOUNDRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLEM_FOUNDRY, "Whenever you cast an artifact spell, you may put a charge counter on this artifact.\nRemove three charge counters from this artifact: Create a 3/3 colorless Golem artifact creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Golem|3/3||Artifact Creature|");

const VOCAB_L0 = vocabularyEffects("Put a charge counter on this artifact.", GOLEM_FOUNDRY.name);
const VOCAB_T_L0 = vocabularyTargets("Put a charge counter on this artifact.");

export const GOLEM_FOUNDRY_SCRIPT: CardScript = {
  oracleId: GOLEM_FOUNDRY.oracleId,
  name: GOLEM_FOUNDRY.name,
  activated: [
    {
      ref: `${GOLEM_FOUNDRY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castArtifactSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Golem Foundry - Put a charge counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
