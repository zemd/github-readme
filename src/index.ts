import { cac } from "cac";
import { loadPackageJson } from "package-json-from-dist";
import { readFile, writeFile, stat } from "node:fs/promises";
import { TemplateEngine } from "./TemplateEngine.js";
import { dirname, join, resolve } from "node:path";
import {
  bold,
  code,
  codeBlock,
  link,
  shield,
  shieldNpmVersion,
  table,
  type TableBuilder,
} from "./markdown.js";
import spdx from "spdx-license-list/full.js";
import { globby } from "globby";
import type { Context } from "./types.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const githubReadmePackageJson = loadPackageJson(import.meta.url);
const cli = cac("github-readme");

const checkFile = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const detectMonorepo = async (rootPkg: any): Promise<boolean> => {
  return (
    (Array.isArray(rootPkg.workspaces) && rootPkg.workspaces.length > 0) ||
    (await checkFile("pnpm-workspace.yaml")) ||
    (await checkFile("vlt-workspaces.json"))
  );
};

const findPackages = async (cwd: string): Promise<[object, string][]> => {
  const paths = await globby(["**/package.json", "!./package.json", "!node_modules"], {
    gitignore: true,
    cwd,
  });
  const packages = await Promise.all(
    paths.map((pkgPath): any => {
      const absolutePkgPath = resolve(cwd, pkgPath);
      return readFile(absolutePkgPath, "utf8").then((pkgStr: string) => {
        return [JSON.parse(pkgStr), pkgPath];
      });
    }),
  );
  return packages.filter(([pkg]) => {
    return !pkg.private;
  });
};

const engine = new TemplateEngine();

engine.registerBlock("installation", (params, context) => {
  const pkgManagers = params.pkgManagers
    ? params.pkgManagers.split(",")
    : ["npm install --save-dev", "pnpm add -D"];

  const pkg = params.package ?? context.name;
  const installPkg = pkgManagers.reduce((acc, pgkManager) => {
    return `${acc}\n${pgkManager} ${pkg}`;
  }, "");

  return codeBlock({
    lang: "bash",
    code: installPkg,
  });
});

engine.registerBlock("license", (_params, context) => {
  const licenseSpdx = spdx[context.license];
  const [name, url] = licenseSpdx ? [licenseSpdx.name, licenseSpdx.url] : [context.license];
  const formatted = bold(url ? link(name, url) : name);

  return `The ${code(context.name)} is licensed under ${formatted} 😇.`;
});

engine.registerBlock("packages", (_params, context) => {
  const { packages } = context;
  return packages
    .reduce(
      (acc: TableBuilder, [pkg, pkgPath]: [any, string]) => {
        return acc.addRow([
          link(pkg.name, join(dirname(pkgPath), "README.md")),
          shieldNpmVersion({
            packageName: pkg.name,
            color: "#0000ff",
            labelColor: "#000",
          }),
          pkg.description,
          spdx[pkg.license]?.name || pkg.license,
        ]);
      },
      table(["Package", "Version", "Description", "License"]),
    )
    .toString();
});

engine.registerBlock("donate", () => {
  return shield({
    label: "UNITED24",
    message: "support Ukraine",
    color: "blue",
    href: "https://u24.gov.ua/",
  });
});

engine.registerBlock("badgeNpmVersion", (params) => {
  if (!params.packageName) {
    throw new Error("packageName param is required for badgeNpmVersion block");
  }
  return shieldNpmVersion({
    packageName: params.packageName,
    color: params.color,
    labelColor: params.labelColor,
  });
});

engine.registerBlock("ai", async (params) => {
  if (!params.prompt) {
    throw new Error("prompt param is required for ai block");
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable is required for ai block");
    return "";
  }
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: "You are technical writer and you need to write a README.md file for your project.",
    prompt: params.prompt,
    temperature: 0.5,
  });
  return text;
});

type BuildParams = {
  output?: string;
};

cli
  .command("build <input>", "Build README.md file")
  .option("-o, --output <output>", "Output file")
  .option("--title <title>", "Project title")
  .option("--description <description>", "Project description")
  .action(async (input: string, params: BuildParams) => {
    const { output, ...rest } = params;
    console.log("CWD: ", process.cwd());
    const rootPkg = JSON.parse(await readFile(resolve(process.cwd(), "package.json"), "utf8"));
    const source = resolve(process.cwd(), input);
    console.log("INPUT: ", source);
    const content = await readFile(source, "utf8");
    const context: Context = {
      name: rootPkg.name,
      title: rootPkg.name,
      description: rootPkg.description,
      license: rootPkg.license,
      workspaces: rootPkg.workspaces, // TODO: read from pnpm-workspace.yaml or vlt-workspaces.json
      monorepo: await detectMonorepo(rootPkg),
      packages: await findPackages(process.cwd()),
      ...rest,
    };

    await writeFile(params.output ?? "README.md", await engine.render(content, context));
    console.log("README.md file generated");
  });

cli.help();
cli.version(githubReadmePackageJson.version);

cli.parse();
