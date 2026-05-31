import type { ProjectMap } from "../map/types.js";

/** A node in the project mind map. */
export interface MindMapNode {
  id: string;
  label: string;
  kind: "root" | "dir" | "file" | "symbol";
  children: MindMapNode[];
}

/**
 * Build a mind map tree from a project map. Directories become branches,
 * files become leaves, and a file's exported symbols hang off it. This is a
 * pure transform so it is trivial to test.
 */
export function buildMindMap(map: ProjectMap): MindMapNode {
  const rootLabel = map.root.split("/").filter(Boolean).pop() ?? "project";
  const root: MindMapNode = {
    id: ".",
    label: rootLabel,
    kind: "root",
    children: []
  };
  const dirNodes = new Map<string, MindMapNode>();
  dirNodes.set(".", root);

  function ensureDir(dirPath: string): MindMapNode {
    if (dirNodes.has(dirPath)) return dirNodes.get(dirPath) as MindMapNode;
    const slash = dirPath.lastIndexOf("/");
    const parentPath = slash === -1 ? "." : dirPath.slice(0, slash);
    const label = slash === -1 ? dirPath : dirPath.slice(slash + 1);
    const parent = ensureDir(parentPath);
    const node: MindMapNode = {
      id: dirPath,
      label,
      kind: "dir",
      children: []
    };
    parent.children.push(node);
    dirNodes.set(dirPath, node);
    return node;
  }

  for (const file of map.files) {
    const slash = file.path.lastIndexOf("/");
    const dir = slash === -1 ? "." : file.path.slice(0, slash);
    const name = slash === -1 ? file.path : file.path.slice(slash + 1);
    const parent = ensureDir(dir);
    const fileNode: MindMapNode = {
      id: file.path,
      label: name,
      kind: "file",
      children: file.symbols.slice(0, 12).map((s) => ({
        id: `${file.path}#${s.name}`,
        label: `${s.name} (${s.kind})`,
        kind: "symbol" as const,
        children: []
      }))
    };
    parent.children.push(fileNode);
  }

  return root;
}

/**
 * Render a mind map tree as a Mermaid flowchart, themed with the SarmaLinux
 * palette. This is what the in chat /claudepilot:mindmap command prints, so the
 * user sees the project structure inside Claude Code without a separate
 * dashboard. The tree is collapsed to directories and files to keep the diagram
 * legible; symbol leaves are dropped to keep it readable in chat.
 */
export function mindMapToMermaid(root: MindMapNode, maxNodes = 80): string {
  const lines: string[] = [];
  lines.push(
    "%%{init: {'theme':'base','themeVariables':{" +
      "'primaryColor':'#0d1117','primaryTextColor':'#f5f7fa'," +
      "'primaryBorderColor':'#38bdf8','lineColor':'#22d3ee'," +
      "'fontFamily':'monospace'}}}%%"
  );
  lines.push("flowchart LR");

  let count = 0;
  const idFor = new Map<string, string>();
  let seq = 0;
  function nodeId(path: string): string {
    const existing = idFor.get(path);
    if (existing) return existing;
    const id = `n${seq++}`;
    idFor.set(path, id);
    return id;
  }

  function shape(node: MindMapNode): string {
    const id = nodeId(node.id);
    const label = node.label.replace(/"/g, "'");
    if (node.kind === "root") return `${id}(["${label}"])`;
    if (node.kind === "dir") return `${id}["${label}/"]`;
    if (node.kind === "file") return `${id}["${label}"]`;
    return `${id}("${label}")`;
  }

  function walk(node: MindMapNode): void {
    for (const child of node.children) {
      if (count >= maxNodes) return;
      if (child.kind === "symbol") continue;
      count += 1;
      lines.push(`  ${shape(node)} --> ${shape(child)}`);
      walk(child);
    }
  }

  walk(root);
  if (count === 0) {
    lines.push(`  ${shape(root)}`);
  }
  return lines.join("\n");
}
