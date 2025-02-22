export type Context = {
  title: string;
  description: string;
  license: string;
  monorepo: boolean;
  packages: [object, string][];
  [key: string]: any;
};
