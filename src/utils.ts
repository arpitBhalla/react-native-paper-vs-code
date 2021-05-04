export function once<F extends Function>(fn: F): F {
  let called = false;
  let result: any;

  return function onceified(this: any) {
    if (!called) {
      result = fn.apply(this, arguments);
      called = true;
    }
    return result;
  } as any;
}

export function getSnippetImports(body: string): string[] {
  const rx = /<([A-Z][A-Za-z]+)/g;
  const components: Set<string> = new Set();
  let match;
  while ((match = rx.exec(body))) {
    components.add(match[1]);
  }
  return [...components].sort();
}
