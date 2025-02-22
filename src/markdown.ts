export const bold = (text: string): string => {
  return `**${text}**`;
};

export const link = (text: string, url: string): string => {
  return `[${text}](${url})`;
};

export const code = (text: string): string => {
  return `\`${text}\``;
};

export const image = (src: string): string => {
  return `![](${src})`;
};

type StaticShield = {
  label: string;
  message?: string;
  color?: string;
  href: string;
};
export const shield = (params: StaticShield): string => {
  const url = new URL(`https://img.shields.io/static/v1`);
  url.searchParams.append("label", params.label);
  if (params.message) {
    url.searchParams.append("message", params.message);
  }
  if (params.color) {
    url.searchParams.append("color", params.color);
  }
  url.searchParams.sort();
  const img = image(url.href);
  return link(img, params.href);
};

type NpmVersionShield = {
  packageName: string;
  color?: string | undefined;
  labelColor?: string | undefined;
};
export const shieldNpmVersion = (params: NpmVersionShield): string => {
  const url = new URL(`https://img.shields.io/npm/v/`);
  url.pathname = params.packageName;
  if (params.color) {
    url.searchParams.append("color", params.color);
  }
  if (params.labelColor) {
    url.searchParams.append("labelColor", params.labelColor);
  }
  url.searchParams.sort();
  return link(image(url.href), `https://www.npmjs.com/package/${params.packageName}`);
};

type CodeBlock = {
  lang: string;
  code: string;
};
export const codeBlock = ({ lang, code }: CodeBlock): string => {
  return `\`\`\`${lang}${code}\n\`\`\``;
};

export class TableBuilder {
  private readonly cols: string[];
  private readonly rows: string[][];

  constructor(cols: string[]) {
    this.cols = cols;
    this.rows = [];
  }

  addRow(row: string[]): this {
    this.rows.push(row);
    return this;
  }

  toString(): string {
    const header = this.cols.join(" | ");
    const divider = this.cols
      .map(() => {
        return "---";
      })
      .join(" | ");
    const body = this.rows
      .map((row) => {
        return row.join(" | ");
      })
      .join("\n");
    return `${header}\n${divider}\n${body}`;
  }
}
export const table = (cols: string[]): TableBuilder => {
  return new TableBuilder(cols);
};
