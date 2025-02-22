import { readFileSync } from "node:fs";

type Plugin = (params: Record<string, string>, context: Record<string, any>) => string;

export class TemplateEngine {
  readonly #plugins: Map<string, Plugin> = new Map<string, Plugin>();

  registerBlock(name: string, fn: Plugin): void {
    this.#plugins.set(name, fn);
  }

  render(template: string, context: Record<string, any>): string {
    return this.process(template, context);
  }

  private process(template: string, context: Record<string, any>): string {
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
    result = this.processConditionals(result, context);

    // Handle variables
    result = result.replaceAll(/{{\s*(\w+)\s*}}/g, (_, varName) => {
      return context[varName] !== undefined ? String(context[varName]) : "";
    });

    // Handle custom plugins (blocks)
    result = result.replaceAll(/{{\s*block\s+(\w+)\s*(.*?)\s*}}/g, (_, blockName, paramsStr) => {
      const plugin = this.#plugins.get(blockName);
      if (plugin) {
        return plugin(this.parseParams(paramsStr), context);
      }
      return `Error: Block '${blockName}' not found`;
    });

    return result;
  }

  private processConditionals(template: string, context: Record<string, any>): string {
    const conditionalRegex =
      /{{\s*if\s+(.*?)\s*}}([\s\S]*?)(?:{{\s*else\s*}}([\s\S]*?))?{{\s*endif\s*}}/g;
    return template.replaceAll(conditionalRegex, (_, condition, ifBlock, elseBlock) => {
      const evaluatedCondition = this.evaluateCondition(condition, context);
      return evaluatedCondition
        ? this.process(ifBlock, context)
        : elseBlock
          ? this.process(elseBlock, context)
          : "";
    });
  }

  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
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
