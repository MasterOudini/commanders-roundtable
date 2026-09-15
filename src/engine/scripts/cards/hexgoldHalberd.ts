// `Hexgold Halberd` - a etb trigger germ, a conditional static (as long as it's your turn) attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEXGOLD_HALBERD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEXGOLD_HALBERD, "For Mirrodin! (When this Equipment enters, create a 2/2 red Rebel creature token, then attach this to it.)\nDuring your turn, equipped creature has first strike and trample.\nEquip {2}{R}");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Rebel|2/2|R|Creature|");

// "as long as it's your turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.activePlayer === me;
}


export const HEXGOLD_HALBERD_SCRIPT: CardScript = {
  oracleId: HEXGOLD_HALBERD.oracleId,
  name: HEXGOLD_HALBERD.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Hexgold Halberd - germ",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        const germ = ctx.ids.nextInstance();
        return [
          { t: 'TokenCreated', card: germ, oracleId: TOKEN_L0.oracleId, printingId: TOKEN_L0.printingId, controller: obj.controller, owner: obj.controller, turnNumber: ctx.state.turn.turnNumber },
          { t: 'AttachmentChanged', card: self, to: germ },
        ];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
        chars.keywords.add("trample");
      },
    },
  ],
};
