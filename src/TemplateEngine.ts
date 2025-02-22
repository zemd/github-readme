import { readFileSync } from "node:fs";
import type { Context } from "./types.js";

type Plugin = (params: Record<string, string>, context: Context) => Promise<string> | string;

export class TemplateEngine {
  readonly #plugins: Map<string, Plugin> = new Map<string, Plugin>();

  registerBlock(name: string, fn: Plugin): void {
    this.#plugins.set(name, fn);
  }

  async render(template: string, context: Context): Promise<string> {
    return await this.process(template, context);
  }

  private async process(template: string, context: Context): Promise<string> {
    let result: string;

    // Handle includes
    result = template.replaceAll(/{{\s*include\s+"([^"]+)"\s*}}/g, (_, filePath) => {
      try {
        return readFileSync(filePath, "utf8");
      } catch {
        return `Error: Unable to include file '${filePath}'`;
      }
    });

    // Handle nested conditionals
    result = await this.processConditionals(result, context);

    // Handle variables
    result = result.replaceAll(/{{\s*(\w+)\s*}}/g, (_, varName) => {
      return context[varName] !== undefined ? String(context[varName]) : "";
    });

    // Handle custom plugins (blocks)
    result = await this.processBlocks(result, context);

    return result;
  }

  private async processBlocks(template: string, context: Context): Promise<string> {
    const blockRegex = /{{\s*block\s+(\w+)\s*(.*?)\s*}}/g;
    const matches = [...template.matchAll(blockRegex)];
    let result = template;

    for (const match of matches) {
      const [fullMatch, blockName, paramsStr] = match;
      if (!blockName) {
        continue;
      }
      const plugin = this.#plugins.get(blockName);
      if (plugin) {
        const replacement = await plugin(paramsStr ? this.parseParams(paramsStr) : {}, context);
        result = result.replaceAll(fullMatch, replacement);
      } else {
        result = result.replaceAll(fullMatch, `Error: Block '${blockName}' not found`);
      }
    }

    return result;
  }

  private async processConditionals(template: string, context: Context): Promise<string> {
    const conditionalRegex =
      /{{\s*if\s+(.*?)\s*}}([\s\S]*?)(?:{{\s*else\s*}}([\s\S]*?))?{{\s*endif\s*}}/g;
    let result = template;

    const matches = [...template.matchAll(conditionalRegex)];

    for (const match of matches) {
      const [fullMatch, condition, ifBlock, elseBlock] = match;
      if (!condition) {
        continue;
      }
      const evaluatedCondition = this.evaluateCondition(condition, context);
      const replacement = evaluatedCondition ? ifBlock : (elseBlock ?? "");
      result = result.replaceAll(
        fullMatch,
        replacement ?? `Error: Invalid conditional '${fullMatch}'`,
      );
    }

    return result;
    // return template.replaceAll(conditionalRegex, (_, condition, ifBlock, elseBlock) => {
    //   const evaluatedCondition = this.evaluateCondition(condition, context);
    //   return evaluatedCondition
    //     ? this.process(ifBlock, context)
    //     : elseBlock
    //       ? this.process(elseBlock, context)
    //       : "";
    // });
  }

  private evaluateCondition(condition: string, context: Context): boolean {
    try {
      return new Function(...Object.keys(context), `return Boolean(${condition});`)(
        ...Object.values(context),
      );
    } catch {
      return false;
    }
  }

  private parseParams(paramStr: string): Record<string, string> {
    return Object.fromEntries(
      [...paramStr.matchAll(/(\w+)="(.*?)"/g)].map(([, key, value]) => {
        return [key, value];
      }),
    );
  }
}
