// `Quest for the Gravelord` - a aCreatureDies trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUEST_FOR_THE_GRAVELORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUEST_FOR_THE_GRAVELORD, "Whenever a creature dies, you may put a quest counter on this enchantment.\nRemove three quest counters from this enchantment and sacrifice it: Create a 5/5 black Zombie Giant creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Zombie Giant|5/5|B|Creature|");

const VOCAB_L0 = vocabularyEffects("Put a quest counter on this enchantment.", QUEST_FOR_THE_GRAVELORD.name);
const VOCAB_T_L0 = vocabularyTargets("Put a quest counter on this enchantment.");

export const QUEST_FOR_THE_GRAVELORD_SCRIPT: CardScript = {
  oracleId: QUEST_FOR_THE_GRAVELORD.oracleId,
  name: QUEST_FOR_THE_GRAVELORD.name,
  activated: [
    {
      ref: `${QUEST_FOR_THE_GRAVELORD.oracleId}#a0`,
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
      abilityId: 'aCreatureDies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Quest for the Gravelord - Put a quest counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
