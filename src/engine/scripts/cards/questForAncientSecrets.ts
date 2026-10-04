// `Quest for Ancient Secrets` - a cardPutIntoGraveyard trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUEST_FOR_ANCIENT_SECRETS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUEST_FOR_ANCIENT_SECRETS, "Whenever a card is put into your graveyard from anywhere, you may put a quest counter on this enchantment.\nRemove five quest counters from this enchantment and sacrifice it: Target player shuffles their graveyard into their library.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a quest counter on this enchantment.", QUEST_FOR_ANCIENT_SECRETS.name);
const VOCAB_T_L0 = vocabularyTargets("Put a quest counter on this enchantment.");
const VOCAB_A0 = vocabularyEffects("Target player shuffles their graveyard into their library.", QUEST_FOR_ANCIENT_SECRETS.name);
const VOCAB_T_A0 = vocabularyTargets("Target player shuffles their graveyard into their library.");

export const QUEST_FOR_ANCIENT_SECRETS_SCRIPT: CardScript = {
  oracleId: QUEST_FOR_ANCIENT_SECRETS.oracleId,
  name: QUEST_FOR_ANCIENT_SECRETS.name,
  activated: [
    {
      ref: `${QUEST_FOR_ANCIENT_SECRETS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.to.player === ctx.query.controllerOf(self),
        ),
      label: () => "Quest for Ancient Secrets - Put a quest counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
