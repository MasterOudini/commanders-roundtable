// `Baxter Stockman` - a etb trigger token, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BAXTER_STOCKMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BAXTER_STOCKMAN, "When Baxter Stockman enters, create a 1/1 colorless Robot artifact creature token.\nAt the beginning of combat on your turn, target artifact creature you control gets +3/+0 and gains first strike and vigilance until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Robot|1/1||Artifact Creature|");

const VOCAB_L1 = vocabularyEffects("Target artifact creature you control gets +3/+0 and gains first strike and vigilance until end of turn.", BAXTER_STOCKMAN.name);
const VOCAB_T_L1 = vocabularyTargets("Target artifact creature you control gets +3/+0 and gains first strike and vigilance until end of turn.");

export const BAXTER_STOCKMAN_SCRIPT: CardScript = {
  oracleId: BAXTER_STOCKMAN.oracleId,
  name: BAXTER_STOCKMAN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Baxter Stockman - token",
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
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Baxter Stockman - Target artifact creature you control gets +3/+0 and gains first strike and vigilance until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
