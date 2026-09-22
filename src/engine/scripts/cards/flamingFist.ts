// `Flaming Fist` - a static anthem, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAMING_FIST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(FLAMING_FIST, "Commander creatures you own have \"Whenever this creature attacks, it gains double strike until end of turn.\"");

const VOCAB_L0 = vocabularyEffects("~ gains double strike until end of turn.", FLAMING_FIST.name);
const VOCAB_T_L0 = vocabularyTargets("~ gains double strike until end of turn.");

const GRANT_0 = grantedTriggerRef(`${FLAMING_FIST.oracleId}#gt0`, FLAMING_FIST.name);

export const FLAMING_FIST_SCRIPT: CardScript = {
  oracleId: FLAMING_FIST.oracleId,
  name: FLAMING_FIST.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Flaming Fist - ~ gains double strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.players[ctx.query.controllerOf(self) ?? '']?.commanderIds ?? []).includes(candidate),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
