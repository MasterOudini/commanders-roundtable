// `Blightreaper Thallid // Blightsower Thallid` - an activation vocab, a transformsInto trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID, "{3}{G/P}: Transform this creature. Activate only as a sorcery. ({G/P} can be paid with either {G} or 2 life.)\nWhen this creature transforms into Blightsower Thallid or dies, create a 1/1 green Phyrexian Saproling creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Phyrexian Saproling|1/1|G|Creature|");

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID_SCRIPT: CardScript = {
  oracleId: BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID.oracleId,
  name: BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID.name,
  activated: [
    {
      ref: `${BLIGHTREAPER_THALLID_BLIGHTSOWER_THALLID.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'transformsInto-1', face: 1,
      text: LINES[1] as string,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceIndexSet' && ev.card === self,
      label: () => "Blightreaper Thallid // Blightsower Thallid - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
