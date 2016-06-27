import Koa from 'koa';
import React from 'react';
import path from 'path';
import debug from 'debug';
import routes from './routes';
import ReactDOM from 'react-dom/server';
import compress from 'koa-compress';
import session from 'koa-session-store';
import serve from 'koa-static';
import favicon from 'koa-favicon';
import { match, RouterContext } from 'react-router';
import { Provider } from 'react-redux';
import createStore from './reducer';
import Html from './helpers/Html';
import { router } from './controller';
import isomFetch from 'isom-fetch';

const app = new Koa();
const { PORT } = process.env;

app.use(compress());
app.use(favicon(path.join(__dirname, '../static/favicon.ico')));
app.use(session());
app.use(serve(path.join(__dirname, '../static')));

app.use(router.routes());

const getRouteContext = (ctx) =>
  new Promise((resolve, reject) => {
    match({
      routes: routes(),
      location: ctx.originalUrl,
    }, (error, redirect, renderProps) => {
      if (error) {
        reject({ status: 500, error });
      } else if (redirect) {
        reject({ status: 302, redirect });
      } else if (renderProps) {
        const fetch = isomFetch.use(ctx, router);
        const store = createStore();
        const component = (
          <Provider store={store} key="provider">
            <RouterContext {...renderProps} />
          </Provider>
        );

        const render = () => `<!DOCTYPE html>\n${
          ReactDOM.renderToString(
            <Html
              assets={webpackIsomorphicTools.assets()}
              component={component}
              store={store}
            />
        )}`;

        render();
        fetch.all(() => resolve(render()));
      } else {
        resolve('NOT_MATCH');
      }
    });
  });

app.use(function* serverRender() {
  if (__DEVELOPMENT__) {
    webpackIsomorphicTools.refresh();
  }
  const result = yield getRouteContext(this);
  if (result !== 'NOT_MATCH') {
    this.body = result;
  }
});

app.listen(PORT, (err) => {
  if (err) {
    debug('error')(err);
  } else {
    debug('server')('==> 🌞  Webpack development server listening on port %s', PORT);
  }
});