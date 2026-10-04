// `Feasting Troll King` - a etb trigger token, an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEASTING_TROLL_KING } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(FEASTING_TROLL_KING, "Vigilance, trample\nWhen this creature enters, if you cast it from your hand, create three Food tokens. (They're artifacts with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")\nSacrifice three Foods: Return this card from your graveyard to the battlefield. Activate only during your turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Food|/||Artifact|");

// "as long as you cast it from your hand" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.cards[self]?.castFromZone === 'hand';
}


export const FEASTING_TROLL_KING_SCRIPT: CardScript = {
  oracleId: FEASTING_TROLL_KING.oracleId,
  name: FEASTING_TROLL_KING.name,
  activated: [
    {
      ref: `${FEASTING_TROLL_KING.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Feasting Troll King - token",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return Array.from({ length: 3 }, () => ({
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
