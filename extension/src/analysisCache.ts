import * as vscode from 'vscode';

type SymbolCacheEntry = {
  version: number;
  symbols: vscode.DocumentSymbol[];
};

type ReferenceCacheEntry = {
  uri: string;
  version: number;
  positionKey: string;
  references: vscode.Location[];
};

const symbolCache = new Map<string, SymbolCacheEntry>();
const referenceCache = new Map<string, ReferenceCacheEntry>();

const SYMBOL_CACHE_LIMIT = 200;
const REFERENCE_CACHE_LIMIT = 400;

export async function getDocumentSymbols(
  document: vscode.TextDocument
): Promise<vscode.DocumentSymbol[] | undefined> {
  const key = document.uri.toString();
  const cached = symbolCache.get(key);
  if (cached && cached.version === document.version) {
    return cached.symbols;
  }

  const symbols = (await vscode.commands.executeCommand(
    'vscode.executeDocumentSymbolProvider',
    document.uri
  )) as vscode.DocumentSymbol[] | undefined;

  if (!symbols || symbols.length === 0) {
    symbolCache.delete(key);
    return undefined;
  }

  symbolCache.set(key, { version: document.version, symbols });
  pruneMap(symbolCache, SYMBOL_CACHE_LIMIT);
  return symbols;
}

export async function getReferences(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Location[] | undefined> {
  const key = document.uri.toString();
  const posKey = `${position.line}:${position.character}`;
  const cacheKey = `${key}::${document.version}::${posKey}`;
  const cached = referenceCache.get(cacheKey);
  if (cached && cached.version === document.version) {
    return cached.references;
  }

  const refs = (await vscode.commands.executeCommand(
    'vscode.executeReferenceProvider',
    document.uri,
    position
  )) as vscode.Location[] | undefined;

  if (!refs || refs.length === 0) {
    referenceCache.delete(cacheKey);
    return undefined;
  }

  referenceCache.set(cacheKey, {
    uri: key,
    version: document.version,
    positionKey: posKey,
    references: refs
  });
  pruneMap(referenceCache, REFERENCE_CACHE_LIMIT);
  return refs;
}

export function invalidateDocumentCache(uri: vscode.Uri): void {
  const key = uri.toString();
  symbolCache.delete(key);
  for (const cacheKey of referenceCache.keys()) {
    if (cacheKey.startsWith(`${key}::`)) {
      referenceCache.delete(cacheKey);
    }
  }
}

function pruneMap<K, V>(map: Map<K, V>, limit: number): void {
  while (map.size > limit) {
    const firstKey = map.keys().next().value;
    if (firstKey === undefined) return;
    map.delete(firstKey);
  }
}
