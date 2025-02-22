import { cac } from "cac";
import { loadPackageJson } from "package-json-from-dist";
import { readFile, writeFile, stat } from "node:fs/promises";
import { TemplateEngine } from "./TemplateEngine.js";
import { resolve } from "node:path";
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

const pkg = loadPackageJson(import.meta.url);
const cli = cac("github-readme");

const checkFile = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const detectMonorepo = async (): Promise<boolean> => {
  return (
    (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) ||
    (await checkFile("pnpm-workspace.yaml")) ||
    (await checkFile("vlt-workspaces.json"))
  );
};

const findPackages = async (root: string) => {
  const paths = await globby(["**/package.json", "!./package.json", "!node_modules"], {
    gitignore: true,
    cwd: root,
  });
  const packages = await Promise.all(
    paths.map((pkgPath): any => {
      return readFile(pkgPath, "utf8");
    }),
  );
  return packages.filter((pkg) => {
    return !pkg.private;
  });
};

const engine = new TemplateEngine();

engine.registerBlock("installation", (params) => {
  const packages = params.packages
    ? params.packages.split(",")
    : ["npm install --save-dev", "pnpm add -D"];
  const installPkg = packages.reduce((acc, packg) => {
    return `${acc}\n${packg} ${pkg.name}`;
  }, "");

  return codeBlock({
    lang: "bash",
    code: installPkg,
  });
});

engine.registerBlock("license", () => {
  const licenseSpdx = spdx[pkg.license];
  const [name, url] = licenseSpdx ? [licenseSpdx.name, licenseSpdx.url] : [pkg.license];
  const formatted = bold(url ? link(name, url) : name);

  return `The ${code(pkg.name)} is licensed under ${formatted} 😇.`;
});

engine.registerBlock("packages", (_params, context) => {
  const { packages } = context;
  return packages.reduce(
    (acc: TableBuilder, pkg: any) => {
      return acc.addRow([
        pkg.name,
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
  );
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
    const source = resolve(process.cwd(), input);
    const content = await readFile(source, "utf8");
    const context = {
      title: pkg.name,
      description: pkg.description,
      license: pkg.license,
      monorepo: await detectMonorepo(),
      packages: await findPackages(process.cwd()),
      ...rest,
    };
    console.log("context: ", context);

    await writeFile(params.output ?? "README.md", engine.render(content, context));
    console.log("README.md file generated");
  });

cli.help();
cli.version(pkg.version);

cli.parse();
