import type { RequestContext } from '@/types';
import { deserialize } from '@/utils/serialization';
import transferStoreService from '@/utils/transfer-store-service';
import { resolveStore } from '@/utils/transfer-store-service';
import { logError } from '@/utils/log/log-build';
import { pathToFileURLWhenNeeded } from '../get-importable-filepath';
import importFileIfExists from '../import-file-if-exists';
import { getConstants } from '@/constants';

const DEPENDENCIES = Symbol.for('DEPENDENCIES');

export default async function responseAction(req: RequestContext) {
  const { BUILD_DIR } = getConstants();
  const actionModule = await importFileIfExists('actions', BUILD_DIR);

  const { transferClientStoreToServer, formData, body } =
    await transferStoreService(req);
  const url = new URL(req.url);
  const action =
    req.headers.get('x-action') ?? url.searchParams.get('_aid') ?? '';
  const actionsHeaderValue = req.headers.get('x-actions') ?? '[]';
  let resetForm = false;

  const target = {
    action: req.url,
    autocomplete: 'on',
    enctype: 'multipart/form-data',
    encoding: 'multipart/form-data',
    method: 'post',
    elements: {},
    reset: () => {
      resetForm = true;
    },
  };

  let params = formData
    ? [
        {
          isTrusted: true,
          bubbles: false,
          cancelBubble: false,
          cancelable: false,
          composed: false,
          currentTarget: target,
          defaultPrevented: true,
          eventPhase: 0,
          formData,
          returnValue: true,
          srcElement: null,
          target,
          timeStamp: 0,
          type: 'formdata',
        },
      ]
    : (body?.args ?? []);

  const isWebComponentEvent =
    typeof params[0] === 'object' &&
    'isTrusted' in params[0] &&
    'detail' in params[0] &&
    params[0]._wc;

  if (isWebComponentEvent) params = params[0].detail;

  // Transfer client store to server store
  transferClientStoreToServer();

  const actionCallPromises: [string, Promise<unknown>][] = [];
  const responses: Response[] = [];

  const deps = actionsHeaderValue ? deserialize(actionsHeaderValue) : [];
  let props: Record<string, any> = {};

  req.store.set(`__params:${action}`, params);
  req.store.set(DEPENDENCIES, deps);

  // This part allows actions to be passed as props to enable nested actions
  // of other components. To make this possible, the HTML stores in the HTML
  // the actions id that are dependencies ordered in an array by parent
  // component, grandparent component, grand-grandparent, etc.
  for (let i = deps.length - 1; i >= 0; i -= 1) {
    props = processActions(deps[i], props);
  }

  function processActions(actions: [string, string], props = {}) {
    const nextProps: Record<string, any> = {};

    for (const [eventName, actionId] of actions) {
      nextProps[eventName] = async (...params: unknown[]) => {
        const { promise, resolve, reject } = Promise.withResolvers();
        const actionDependency = actionModule[actionId];

        actionCallPromises.push([actionId, promise]);
        req.store.set(`__params:${actionId}`, params);

        try {
          const res = await actionDependency(props, req);

          if (res instanceof Response) responses.push(res);
          actionCallPromises.pop();
          resolve(res);

          return res;
        } catch (error) {
          reject(error);
        }
      };
    }

    return nextProps;
  }

  if (!actionModule[action]) {
    logError({
      messages: [
        `The action ${action} was not found.`,
        `Don't worry, it's not your fault. Probably a bug in Brisa.`,
      ],
      docTitle: 'Please report it',
      docLink: 'https://github.com/brisa-build/brisa/issues/new',
      req,
    });

    return new Response(resolveStore(req), {
      status: 404,
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  const { promise, resolve } = Promise.withResolvers();

  actionCallPromises.push([action, promise]);

  // _p is a function used inside the actions to wrap
  // all the sync function calls, to await for that that are async
  // in reality.
  // @ts-ignore - req._p should not be a public type
  req._p = (promise: Promise<unknown>) => {
    if (promise instanceof Promise) {
      actionCallPromises.push(['', promise]);
    }
    return promise;
  };

  // waitActionCallPromises is a function used inside the actions to wait for
  // all nested actions calls at the end (when they don't use "await").
  // @ts-ignore - req.waitActionCallPromises should not be a public type
  req._waitActionCallPromises = (currentActionId: string) => {
    const currentPromiseIndex = actionCallPromises.findIndex(
      ([actionId]) => actionId === currentActionId,
    );

    return Promise.all(
      actionCallPromises
        .slice(currentPromiseIndex + 1)
        .map(([, promise]) => promise),
    );
  };

  let response = await actionModule[action](props, req);
  const isResponse = response instanceof Response;
  resolve(response);

  if (!isResponse && responses.length > 0) {
    response = responses[0];
  }

  if (!(response instanceof Response)) {
    response = new Response(resolveStore(req), {
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  const module = req.route
    ? await import(pathToFileURLWhenNeeded(req.route.filePath))
    : {};
  const pageResponseHeaders =
    (await module.responseHeaders?.(req, response.status)) ?? {};

  // Transfer page response headers
  for (const [key, value] of Object.entries(pageResponseHeaders)) {
    response.headers.set(key, value);
  }

  // Reset form after use e.target.reset() in server action
  if (resetForm) {
    response.headers.set('X-Reset', '1');
  }

  return response;
}
