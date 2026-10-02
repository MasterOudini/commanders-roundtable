// `Baku Altar` - a castSpiritOrArcane trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BAKU_ALTAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BAKU_ALTAR, "Whenever you cast a Spirit or Arcane spell, you may put a ki counter on this artifact.\n{2}, {T}, Remove a ki counter from this artifact: Create a 1/1 colorless Spirit creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Spirit|1/1||Creature|");

const VOCAB_L0 = vocabularyEffects("Put a ki counter on this artifact.", BAKU_ALTAR.name);
const VOCAB_T_L0 = vocabularyTargets("Put a ki counter on this artifact.");

export const BAKU_ALTAR_SCRIPT: CardScript = {
  oracleId: BAKU_ALTAR.oracleId,
  name: BAKU_ALTAR.name,
  activated: [
    {
      ref: `${BAKU_ALTAR.oracleId}#a0`,
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
      abilityId: 'castSpiritOrArcane-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Baku Altar - Put a ki counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
