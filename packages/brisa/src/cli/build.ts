import fs from 'node:fs';
import path from 'node:path';
import compileAll from '@/utils/compile-all';
import { getConstants } from '@/constants';
import byteSizeToString from '@/utils/byte-size-to-string';
import { logTable, generateStaticExport } from './build-utils';
import compileBrisaInternalsToDoBuildPortable from '@/utils/compile-serve-internals-into-build';
import { log } from '@/utils/log/log-build';
import { runtimeVersion } from '@/utils/js-runtime-util';
import { createDenoJSON } from '@/build-utils/create-deno-json';

const outputText = {
  bun: 'Bun.js Web Service App',
  node: 'Node.js Server App',
  deno: 'Deno Server App',
  static: 'Static Site App',
  android: 'Android App',
  ios: 'iOS App',
  desktop: 'Desktop App',
};

export default async function build() {
  const constants = getConstants();
  const {
    IS_PRODUCTION,
    I18N_CONFIG,
    LOG_PREFIX,
    BUILD_DIR,
    ROOT_DIR,
    VERSION,
    IS_STATIC_EXPORT,
    CONFIG,
    JS_RUNTIME,
  } = constants;
  const prebuildPath = path.join(ROOT_DIR, 'prebuild');

  log(
    LOG_PREFIX.INFO,
    `🚀 Brisa ${VERSION}: Running on ${runtimeVersion(JS_RUNTIME)}`,
  );

  log(
    LOG_PREFIX.WAIT,
    IS_PRODUCTION
      ? `building your ${outputText[CONFIG.output ?? 'bun']}...`
      : 'starting the development server...',
  );

  const start = Bun.nanoseconds();

  if (fs.existsSync(BUILD_DIR)) {
    // Remove all files and folders except _brisa folder
    const files = fs.readdirSync(BUILD_DIR);
    for (const file of files) {
      if (file === '_brisa') continue;
      fs.rmSync(path.join(BUILD_DIR, file), { recursive: true });
    }
  }

  // Copy prebuild folder inside build
  // useful for FFI: https://brisa.build/building-your-application/configuring/zig-rust-c-files
  if (fs.existsSync(prebuildPath)) {
    const finalPrebuildPath = path.join(BUILD_DIR, 'prebuild');
    fs.cpSync(prebuildPath, finalPrebuildPath, { recursive: true });
    log(
      LOG_PREFIX.INFO,
      LOG_PREFIX.TICK,
      `Copied prebuild folder inside build`,
    );
    if (IS_PRODUCTION && !IS_STATIC_EXPORT) console.log(LOG_PREFIX.INFO);
  }

  const { success, pagesSize } = await compileAll();
  let generated;

  if (!success) return process.exit(1);

  if (IS_PRODUCTION && IS_STATIC_EXPORT) console.log(LOG_PREFIX.INFO);
  log(LOG_PREFIX.INFO, LOG_PREFIX.TICK, `Compiled successfully!`);

  if (IS_PRODUCTION && IS_STATIC_EXPORT && pagesSize) {
    log(LOG_PREFIX.INFO);
    log(LOG_PREFIX.WAIT, '📄 Generating static pages...');
    [generated] = (await generateStaticExport()) ?? [];

    if (!generated) return process.exit(1);

    const logs = [];

    for (const [pageName, size] of Object.entries(pagesSize)) {
      const route = pageName.replace(BUILD_DIR, '');
      const isPage = route.startsWith('/pages');
      const prerenderedRoutes = generated.get(route) ?? [];

      if (!isPage) continue;

      logs.push({
        Route: `○ ${route.replace('.js', '')}`,
        'JS client (gz)': byteSizeToString(size ?? 0, 0, true),
      });

      if (prerenderedRoutes.length > 1) {
        for (const prerenderRoute of prerenderedRoutes) {
          logs.push({
            Route: `| ○ ${prerenderRoute.replace('.html', '')}`,
            'JS client (gz)': byteSizeToString(size ?? 0, 0, true),
          });
        }
      }
    }

    log(LOG_PREFIX.INFO);
    logTable(logs);

    log(LOG_PREFIX.INFO);
    log(LOG_PREFIX.INFO, '○  (Static)  prerendered as static content');
    if (I18N_CONFIG?.locales?.length) {
      log(LOG_PREFIX.INFO, 'Ω  (i18n) prerendered for each locale');
    }
    log(LOG_PREFIX.INFO);

    log(
      LOG_PREFIX.INFO,
      LOG_PREFIX.TICK,
      `Generated static pages successfully!`,
    );
    log(LOG_PREFIX.INFO);
  }

  await compileBrisaInternalsToDoBuildPortable();

  if (IS_PRODUCTION && CONFIG.output === 'deno') {
    createDenoJSON();
  }

  if (IS_PRODUCTION && CONFIG.outputAdapter) {
    log(LOG_PREFIX.WAIT, `Adapting output to ${CONFIG.outputAdapter.name}...`);
    await CONFIG.outputAdapter.adapt(constants, generated);
  }

  const end = Bun.nanoseconds();
  const ms = ((end - start) / 1e6).toFixed(2);

  if (IS_PRODUCTION) log(LOG_PREFIX.INFO, `✨  Done in ${ms}ms.`);
  else log(LOG_PREFIX.INFO, `compiled successfully in ${ms}ms.`);
}

if (import.meta.main) {
  await build();
  process.exit(0);
}
