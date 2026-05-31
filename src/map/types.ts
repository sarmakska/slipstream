/**
 * The compact project map. The whole point is that an agent can read this one
 * structure instead of every file in the tree, then pull a single scoped slice
 * when it needs detail. Everything here is deliberately small.
 */

export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "const"
  | "enum"
  | "component"
  | "default";

export interface ExportedSymbol {
  name: string;
  kind: SymbolKind;
  /** One based line where the symbol is declared. */
  line: number;
}

export interface FileEntry {
  /** Path relative to the project root, always forward slashed. */
  path: string;
  /** Inferred one line purpose, from the leading comment or heuristics. */
  purpose: string;
  /** Exported symbols, the public surface of the file. */
  symbols: ExportedSymbol[];
  /** Imported module specifiers, deduplicated. */
  imports: string[];
  /** Size in bytes, so an agent can budget a read. */
  bytes: number;
  /** Total line count. */
  lines: number;
}

export interface ProjectMap {
  /** Generator version, so consumers can detect format drift. */
  version: 1;
  /** Absolute root the map was generated from. */
  root: string;
  /** When the map was generated, ISO 8601. */
  generatedAt: string;
  /** Detected entry points, for example bin scripts and main fields. */
  entryPoints: string[];
  /** Every indexed file. */
  files: FileEntry[];
  /** Aggregate counts, handy for the dashboard and for budgeting. */
  stats: {
    fileCount: number;
    symbolCount: number;
    totalBytes: number;
  };
}

/** A scoped slice of a single symbol, returned by the retrieval helper. */
export interface SymbolSlice {
  path: string;
  symbol: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  code: string;
}
