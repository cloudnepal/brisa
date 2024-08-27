import { describe, it, expect } from 'bun:test';
import AST from '../ast';
import renderOnBuild from '.';
import { normalizeHTML } from '@/helpers';

const { parseCodeToAST, generateCodeFromAST } = AST('tsx');

describe('utils', () => {
  describe('renderOnBuildTime aka: renderOn="build"', () => {
    it('should not transform the ast if there is no renderOn="build"', () => {
      const code = `
				import Foo from '@/foo';

				export default function App() {
					return <Foo foo="bar" />;
				}
			`;
      const expectedCode = toExpected(code);

      const output = getOutput(code);
      expect(output).toEqual(expectedCode);
    });

    it('should only remove the attribute if there is renderOn="runtime"', () => {
      const code = `
				import Foo from '@/foo';

				export default function App() {
					return <Foo renderOn="runtime" foo="bar" />;
				}
			`;
      const expectedCode = toExpected(`
				import Foo from '@/foo';
				
				export default function App() {
					return <Foo foo="bar" />;
				}`);

      const output = getOutput(code);
      expect(output).toEqual(expectedCode);
    });
    it('should transform the ast to apply the prerender macro', () => {
      const code = `
				import Foo from '@/foo';

				export default function App() {
					return <Foo renderOn="build" foo="bar" />;
				}
			`;
      const expectedCode = normalizeHTML(`
				import {__prerender__macro} from 'brisa/server';
				import Foo from '@/foo';

				export default function App() {
					return __prerender__macro({
						componentPath: "@/foo",
						componentModuleName: "default",
						componentProps: {foo: "bar"}
					});
				}
			`);

      const output = getOutput(code);
      expect(output).toEqual(expectedCode);
    });

    it('should transform inside a fragment', () => {
      const code = `
				import Foo from '@/foo';

				export default function App() {
					return (
						<>
							<Foo renderOn="build" foo="bar" />
						</>
					);
				}
			`;
      const expectedCode = toExpected(`
				import {__prerender__macro} from 'brisa/server';
				import Foo from '@/foo';

				export default function App() {
					return (
						<>
							{__prerender__macro({
								componentPath: "@/foo",
								componentModuleName: "default",
								componentProps: {foo: "bar"}
							})}
						</>
					);
				}
			`);

      const output = getOutput(code);
      expect(output).toEqual(expectedCode);
    });
  });
});

function getOutput(code: string) {
  const ast = parseCodeToAST(code);
  const p = renderOnBuild();
  const newAst = JSON.parse(
    JSON.stringify(ast, p.step1_modifyJSXToPrerenderComponents),
  );

  p.step2_addPrerenderImport(newAst);

  return normalizeHTML(generateCodeFromAST(newAst));
}

function toExpected(code: string) {
  return normalizeHTML(generateCodeFromAST(parseCodeToAST(code)));
}
