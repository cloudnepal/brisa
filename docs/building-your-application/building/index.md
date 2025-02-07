---
description: Learn how to build your Brisa app to production
prev:
  text: "Integrating Tailwind CSS"
  link: "/building-your-application/integrations/tailwind-css"
next:
  text: "Web Service App"
  link: "/building-your-application/building/web-service-app"
---

# Building

Congratulations, it's time to build your application in production.

## Production Builds

Running `brisa build` generates an optimized version of your application for production. HTML, CSS, and JavaScript files are created based on your pages. JavaScript is **compiled** and browser bundles are **minified** using the [Bun Compiler](https://bun.sh/docs/bundler) to help achieve the best performance.

### Bun Server

Brisa can be deployed to any hosting provider that supports Bun. Ensure your `package.json` has the `"build"` and `"start"` scripts:

:::tabs key:language
==package.json

```json
{
  "scripts": {
    "dev": "brisa dev",
    "build": "brisa build",
    "start": "brisa start"
  }
}
```

:::

Then, run `bun run build` to build your application. Finally, run `bun run start` to start the Bun server. This server supports all Brisa features.

But if you need Node.js or Deno, we support that too, you just have to configure it. See the different build strategies in the next point.

## App Strategy (Static, Server, Desktop, Android, iOS)

Brisa supports multiple [output](/building-your-application/configuring/output) strategies to build your application. You can choose between:

- [Build a Bun Server App](/building-your-application/building/bun-server)
- [Build a Node.js Server App](/building-your-application/building/node-server)
- [Build a Deno Server App](/building-your-application/building/deno-server)
- [Build a Static Site App](/building-your-application/building/static-site-app)
- [Build a Desktop App](/building-your-application/building/desktop-app)
- [Build a Android App](/building-your-application/building/android-app)
- [Build a iOS App](/building-your-application/building/ios-app)

## Web Component Compiler

Brisa is more than a framework; it is a **Web Component Compiler**. You can create web components using Brisa and build them to create a library.

- [Web Component Compiler](/building-your-application/building/web-component-compiler)
