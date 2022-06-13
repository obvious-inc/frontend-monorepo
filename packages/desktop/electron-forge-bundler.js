// based on https://github.com/electron-userland/electron-forge/issues/2306#issuecomment-1034882039

const fs = require("fs/promises");
const path = require("path");
// @ts-ignore missing types for @npmcli/arborist
const Arborist = require("@npmcli/arborist");
const { findRoot } = require("@manypkg/find-root");

/**
 * @typedef {{
 *  workspace: boolean;
 *  type: 'prod' | 'dev' | 'peer' | 'optional'
 *  to: INode;
 * }} IEdge
 */

/**
 * @typedef {{
 *  isLink: boolean;
 *  location: string;
 *  realpath: string;
 *  target: INode;
 *  edgesOut: Map<string, IEdge>;
 * }} INode
 */

/** @type {(node: INode) => INode} */
const resolveLink = (node) => (node.isLink ? resolveLink(node.target) : node);

/** @type {(node: INode, realPath: string) => INode | undefined} */
const getWorkspaceByPath = (node, realPath) =>
  [...node.edgesOut.values()]
    .filter((depEdge) => depEdge.workspace)
    .map((depEdge) => resolveLink(depEdge.to))
    .find((depNode) => depNode.realpath === realPath);

/** @type {(node: INode) => INode[]} */
const collectProdDeps = (node) =>
  [...node.edgesOut.values()]
    .filter((depEdge) => depEdge.type === "prod")
    .map((depEdge) => resolveLink(depEdge.to))
    .flatMap((depNode) => [depNode, ...collectProdDeps(depNode)]);

/** @type {(source: string, destination: string) => Promise<void>} */
const bundle = async (source, destination) => {
  const root = await findRoot(source);
  /** @type {INode} */
  const rootNode = await new Arborist({ path: root }).loadActual();
  const sourceNode = getWorkspaceByPath(rootNode, source);

  if (!sourceNode) {
    throw new Error("couldn't find source node");
  }

  const prodDeps = collectProdDeps(sourceNode);

  for (const dep of prodDeps) {
    const dest = path.join(destination, dep.location);

    await fs.cp(dep.realpath, dest, {
      recursive: true,
      errorOnExist: false,
      verbatimSymlinks: true,
    });
  }
};

module.exports = { bundle };
