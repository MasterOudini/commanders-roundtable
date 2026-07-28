// Deck storage: one JSON file per deck under <dataRoot>/decks/.
//
// Why files rather than SQLite: a player has a handful of decks. This is a
// key-value store of small documents, and adding a native module (electron-rebuild,
// asarUnpack, a per-Electron-version build step) to hold twenty files would be
// cost with no benefit. See DECISIONS.md.
//
// ⚠️ Every path here is derived from a deck id through
// capability.resolveInsideDir, which basename-strips it. The renderer can never
// name a path — only an id, and a malformed id resolves to null rather than to
// something outside the decks folder.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const paths = require('./paths.cjs');
const capability = require('./capability.cjs');
const { readJson, writeJsonAtomic } = require('./jsonstore.cjs');

/** Deck ids are ours, never the renderer's. */
function newDeckId() {
  return crypto.randomUUID();
}

/** Resolve a deck id to its file, or null if the id is not usable. */
function deckPath(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return capability.resolveInsideDir(paths.dirs.decks(), `${id}.json`);
}

/**
 * Shape guard. A deck file is read back and handed to the validator and the
 * engine, so a hand-edited or truncated file must not become a malformed object
 * halfway through a game.
 */
function coerceEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length === 0) return null;
  const quantity = Number.isInteger(raw.quantity) && raw.quantity > 0 && raw.quantity <= 999
    ? raw.quantity
    : 1;
  const entry = {
    quantity,
    name,
    section: typeof raw.section === 'string' ? raw.section : 'main',
    lineNo: Number.isInteger(raw.lineNo) ? raw.lineNo : 0,
    raw: typeof raw.raw === 'string' ? raw.raw : `${quantity} ${name}`,
  };
  if (typeof raw.set === 'string' && raw.set.length > 0) entry.set = raw.set;
  if (typeof raw.collectorNumber === 'string' && raw.collectorNumber.length > 0) {
    entry.collectorNumber = raw.collectorNumber;
  }
  if (raw.foil === true) entry.foil = true;
  return entry;
}

function coerceEntries(raw) {
  if (!Array.isArray(raw)) return [];
  // A Commander deck is 100 cards; 500 lines is already pathological.
  return raw.slice(0, 500).map(coerceEntry).filter(Boolean);
}

function coerceDeck(raw, id) {
  if (!raw || typeof raw !== 'object') return null;
  const now = new Date().toISOString();
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim().length > 0
      ? raw.name.trim().slice(0, 120)
      : 'Untitled deck',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    commanders: coerceEntries(raw.commanders),
    main: coerceEntries(raw.main),
    sideboard: coerceEntries(raw.sideboard),
    houseRuled: raw.houseRuled === true,
    ...(typeof raw.sourceText === 'string'
      // Keep the paste so a re-import can be diffed, but cap it.
      ? { sourceText: raw.sourceText.slice(0, 100_000) }
      : {}),
  };
}

/** Summary for the deck list, without reading every card. */
function summarize(deck) {
  const count = [...deck.commanders, ...deck.main]
    .reduce((sum, e) => sum + e.quantity, 0);
  return {
    id: deck.id,
    name: deck.name,
    updatedAt: deck.updatedAt,
    cardCount: count,
    commanderNames: deck.commanders.map((e) => e.name),
    houseRuled: deck.houseRuled,
  };
}

function list() {
  const dir = paths.dirs.decks();
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -5);
    const deck = get(id);
    if (deck) out.push(summarize(deck));
  }
  // Most recently touched first — the deck you are working on is the one you want.
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

function get(id) {
  const file = deckPath(id);
  if (!file) return null;
  const raw = readJson(file, null);
  return raw ? coerceDeck(raw, id) : null;
}

function save(input) {
  const id = typeof input?.id === 'string' && deckPath(input.id) ? input.id : newDeckId();
  const existing = get(id);
  const deck = coerceDeck(input, id);
  if (!deck) return null;
  deck.createdAt = existing?.createdAt ?? deck.createdAt;
  deck.updatedAt = new Date().toISOString();

  const file = deckPath(id);
  if (!file) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return writeJsonAtomic(file, deck) ? deck : null;
}

/**
 * Move a deck to decks/trash/ rather than unlinking it.
 *
 * Deleting a deck someone spent an evening building should be recoverable, and a
 * recycle folder costs nothing.
 */
function remove(id) {
  const file = deckPath(id);
  if (!file || !fs.existsSync(file)) return false;
  try {
    const trashDir = paths.dirs.deckTrash();
    fs.mkdirSync(trashDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.renameSync(file, path.join(trashDir, `${id}-${stamp}.json`));
    return true;
  } catch {
    return false;
  }
}

function duplicate(id) {
  const deck = get(id);
  if (!deck) return null;
  return save({ ...deck, id: newDeckId(), name: `${deck.name} (copy)`, createdAt: undefined });
}

function rename(id, name) {
  const deck = get(id);
  if (!deck) return null;
  return save({ ...deck, name: typeof name === 'string' ? name : deck.name });
}

module.exports = { list, get, save, remove, duplicate, rename, newDeckId, summarize };
