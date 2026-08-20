declare const __RIPPLE_CLI_VERSION__: string | undefined;

/** 构建时由 tsup define 注入；dev(tsx) 下回退 */
export const CLI_VERSION: string =
  typeof __RIPPLE_CLI_VERSION__ === 'string' ? __RIPPLE_CLI_VERSION__ : '0.0.0-dev';
