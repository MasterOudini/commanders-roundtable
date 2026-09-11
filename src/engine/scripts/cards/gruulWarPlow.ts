// `Gruul War Plow` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRUUL_WAR_PLOW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRUUL_WAR_PLOW, "Creatures you control have trample.\n{1}{R}{G}: This artifact becomes a 4/4 Juggernaut artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ becomes a 4/4 Juggernaut artifact creature until end of turn.", GRUUL_WAR_PLOW.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes a 4/4 Juggernaut artifact creature until end of turn.");

export const GRUUL_WAR_PLOW_SCRIPT: CardScript = {
  oracleId: GRUUL_WAR_PLOW.oracleId,
  name: GRUUL_WAR_PLOW.name,
  activated: [
    {
      ref: `${GRUUL_WAR_PLOW.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
