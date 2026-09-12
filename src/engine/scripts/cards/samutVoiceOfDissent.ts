// `Samut, Voice of Dissent` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAMUT_VOICE_OF_DISSENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAMUT_VOICE_OF_DISSENT, "Flash\nDouble strike, vigilance, haste\nOther creatures you control have haste.\n{W}, {T}: Untap another target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap another target creature.", SAMUT_VOICE_OF_DISSENT.name);
const VOCAB_T_A0 = vocabularyTargets("Untap another target creature.");

export const SAMUT_VOICE_OF_DISSENT_SCRIPT: CardScript = {
  oracleId: SAMUT_VOICE_OF_DISSENT.oracleId,
  name: SAMUT_VOICE_OF_DISSENT.name,
  activated: [
    {
      ref: `${SAMUT_VOICE_OF_DISSENT.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
