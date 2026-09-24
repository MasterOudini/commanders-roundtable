// `Piper of the Swarm` - a static anthem, an activation token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PIPER_OF_THE_SWARM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PIPER_OF_THE_SWARM, "Rats you control have menace.\n{1}{B}, {T}: Create a 1/1 black Rat creature token.\n{2}{B}{B}, {T}, Sacrifice three Rats: Gain control of target creature.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Rat|1/1|B|Creature|");

const VOCAB_A1 = vocabularyEffects("Gain control of target creature.", PIPER_OF_THE_SWARM.name);
const VOCAB_T_A1 = vocabularyTargets("Gain control of target creature.");

export const PIPER_OF_THE_SWARM_SCRIPT: CardScript = {
  oracleId: PIPER_OF_THE_SWARM.oracleId,
  name: PIPER_OF_THE_SWARM.name,
  activated: [
    {
      ref: `${PIPER_OF_THE_SWARM.oracleId}#a0`,
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
    {
      ref: `${PIPER_OF_THE_SWARM.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Rat") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
