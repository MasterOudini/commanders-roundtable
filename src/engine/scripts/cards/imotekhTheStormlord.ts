// `Imotekh the Stormlord` - a cardLeavesYourGraveyard trigger token, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMOTEKH_THE_STORMLORD } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { faceOf } from '../../oracle';
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

const PRINTED = printed(IMOTEKH_THE_STORMLORD, "Phaeron — Whenever one or more artifact cards leave your graveyard, create two 2/2 black Necron Warrior artifact creature tokens.\nGrand Strategist — At the beginning of combat on your turn, another target artifact creature you control gets +2/+2 and gains menace until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Necron Warrior|2/2|B|Artifact Creature|");

const VOCAB_L1 = vocabularyEffects("Another target artifact creature you control gets +2/+2 and gains menace until end of turn.", IMOTEKH_THE_STORMLORD.name);
const VOCAB_T_L1 = vocabularyTargets("Another target artifact creature you control gets +2/+2 and gains menace until end of turn.");

export const IMOTEKH_THE_STORMLORD_SCRIPT: CardScript = {
  oracleId: IMOTEKH_THE_STORMLORD.oracleId,
  name: IMOTEKH_THE_STORMLORD.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'graveyard') return false;
          if (m.from.player !== ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
          if (!oc) return false;
          const f = faceOf(oc, inst?.faceIndex ?? 0);
          return f.typeLine.types.includes('Artifact');
        }),
      label: () => "Imotekh the Stormlord - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
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
      label: () => "Imotekh the Stormlord - Another target artifact creature you control gets +2/+2 and gains menace until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
