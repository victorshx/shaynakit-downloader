import { parse, HTMLElement, Node } from "node-html-parser";
import { Locator } from "playwright";

export function filterNodes(
  nodes: Node[],
  filter: (node: Node) => boolean = (n) => n instanceof HTMLElement
): Node[] {
  return nodes.filter(filter);
}

export function extractUrlFromNode(node: Node): string | null {
  const rawAttribute: string | undefined = node["rawAttrs"];
  if (rawAttribute?.startsWith("href") === true) {
    const regexp = new RegExp(/href=\"(.*)\"/g).exec(rawAttribute);
    return regexp[1];
  }
}

export async function parseToHtml(locator: Locator) {
  return await parse(await locator.innerHTML());
}
