// `Clan Crafter` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLAN_CRAFTER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(CLAN_CRAFTER, "Commander creatures you own have \"{2}, Sacrifice an artifact: Put a +1/+1 counter on this creature and draw a card.\"");

const VOCAB_G0 = vocabularyEffects("Put a +1/+1 counter on this creature and draw a card.", CLAN_CRAFTER.name);
const VOCAB_T_G0 = vocabularyTargets("Put a +1/+1 counter on this creature and draw a card.");

const GRANT_0 = grantedActivated("{2}, Sacrifice an artifact: Put a +1/+1 counter on this creature and draw a card.", `${CLAN_CRAFTER.oracleId}#g0`, CLAN_CRAFTER.name);

export const CLAN_CRAFTER_SCRIPT: CardScript = {
  oracleId: CLAN_CRAFTER.oracleId,
  name: CLAN_CRAFTER.name,
  activated: [
    {
      ref: GRANT_0.ref,
      text: PRINTED,
      granted: GRANT_0.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G0, VOCAB_T_G0);
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
        chars.grantedActivated.push({ provider: self, ref: GRANT_0.ref, ability: GRANT_0.ability });
      },
    },
  ],
};
