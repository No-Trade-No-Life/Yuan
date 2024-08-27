import { writeFileSync } from 'fs';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';

const config = {
  input: './dist/dts/modules.d.ts',
  output: [{ file: './dist/dts/ui-web.d.ts', format: 'es' }],
  onLog: (level, log, handler) => {
    console.info(level, log);
  },
  plugins: [
    dts(),
    {
      resolveId(id) {
        if (id.match(/\.css$/)) return id;
        return null;
      },
      load(id) {
        if (id.match(/\.css$/)) {
          console.info(id);
          return '';
        }
      },
    },
  ],
};
const bundle = await rollup(config);

const output = await bundle.generate(config.output);

output.output.forEach((chunk) => {
  console.info(chunk.fileName);
  const code = chunk.code;
  writeFileSync('./dist/dts/ui-web.d.ts', code);
  const codeForDeclaration = `declare module "@yuants/ui-web" { ${code.replace(/declare/g, '')} }`;
  writeFileSync('./public/ui-web.generated', codeForDeclaration);
});
