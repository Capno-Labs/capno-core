import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// eslint-config-next 15.x ships an eslintrc-style config with no flat export,
// so it is bridged with FlatCompat — the pattern create-next-app generates.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'public/**'] },
  ...compat.extends('next/core-web-vitals'),
];

export default eslintConfig;
