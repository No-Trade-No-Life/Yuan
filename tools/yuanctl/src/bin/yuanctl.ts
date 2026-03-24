#!/usr/bin/env node
import { run } from '../cli';

run(process.argv)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error('Internal error');
    process.exitCode = 1;
  });
