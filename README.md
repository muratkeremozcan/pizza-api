

[![main](https://github.com/muratkeremozcan/pizza-api/actions/workflows/main.yml/badge.svg?branch=main&event=push)](https://github.com/muratkeremozcan/pizza-api/actions/workflows/main.yml) [![cypress-crud-api-test](https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/4q6j7j/main&style=flat&logo=cypress)](https://dashboard.cypress.io/projects/4q6j7j/runs) ![cypress version](https://img.shields.io/badge/cypress-9.6.1-brightgreen) ![cypress-data-session version](https://img.shields.io/badge/cypress--data--session-2.0.0-brightgreen) ![cy-spok version](https://img.shields.io/badge/cy--spok-1.5.2-brightgreen) ![@bahmutov/cy-api version](https://img.shields.io/badge/@bahmutov/cy--api-2.1.3-brightgreen)

[renovate-badge]: https://img.shields.io/badge/renovate-app-blue.svg
[renovate-app]: https://renovateapp.com/


Sample repo for a lambda service using serverless Node and ClaudiaJs. 

The below is a draft  guide on e2e testing Launch Darkly feature flags.  A version of the app prior to the  feature flag setup can be checked out at the branch `before-feature-flags`. The changes in this PR can be found at the PR [feature flag setup and test](https://github.com/muratkeremozcan/pizza-api/pull/4).

TODO: add the entire branch flow

1. `before-feature-flags`
2. `ld-ff-setup-test` : where we fully setup the node SDK for our lambda and showed it working via rest client.
3. `before-cypress-setup`
4. `cypress-setup`: the branch for this section of the guide; [PR](https://github.com/muratkeremozcan/pizza-api/pull/6/files).
5. `after-cypress-setup`: if you want to skip this section, you can start from this branch
6. `ld-ff-ld-e2e `: the branch the blog will be worked on

## LaunchDarkly (LD) feature flags (FF)

The below is a distilled version of LD FF setup documentation for Node lambda functions, applied to a sample API. Throughout the setup there will be references to the UI app flavor of feature flagging in the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part1-the-setup-jfp).

### Create a project at the LD interface

Nav to *<https://app.launchdarkly.com/settings/projects> > Create project*. Give it any name like `pizza-api-example`, and the rest as default.

![Create project](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/5igpl5cpf4knugljjftm.png)

Two default environments get created for us. We can leave them as is, or delete one of them for our example.

The critical item to note here is the **SDK key**, since we are not using a client-side ID. In contrast to our Node API here, the UI app with React was using the [clientSideID](https://github.com/muratkeremozcan/react-hooks-in-action-with-cypress/blob/main/src/index.js#L8). In the beginning code samples, we will keep the SKD key as a string. Later we will use `dotenv` to read them from a local `.env` file, and also we will setup the lambda to include any key that is needed.

![Sdk key](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/bylyld4eg4840181fx1o.png)

### Create a Boolean FF for later use

Nav to <https://app.launchdarkly.com/pizza-api-example/test/features/new> and create a boolean feature flag named `update-order`. You can leave the settings as default, and enter optional descriptions. We will use the flag to toggle the endpoint `PUT {{baseUrl}}/orders/{{orderId}}`.

![Create a feature flag](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8uzw38r75pf8l0550n83.png)

## Setup LD FF at our service

Install the LD SDK as a dependency; `npm install launchdarkly-node-server-sdk`.

### LD & lambda function basic sanity test

Let's start with a simple example, console logging whether LD client initialized successfully. In the handler file  `./handlers/get-orders.js` import the LD client, initialize it, add a simple function to log out the initialization, then invoke it anywhere in the `getOrders()` function.

```js
// ./handlers/get-orders.js

// ...other imports...

const ld = require('launchdarkly-node-server-sdk');

// initialize the LD client

const ldClient = ld.init("sdk-****");

// add a simple function to log out LD client status
const ldClientStatus = async (event) => {
  let response = {
    statusCode: 200,
  };
  try {
    await client.waitForInitialization();
    response.body = JSON.stringify("Initialization successful");
  } catch (err) {
    response.body = JSON.stringify("Initialization failed");
  }
  return response;
};

// the handler function we had in place 
function getOrders(orderId) {
  console.log("Get order(s)", orderId);

  console.log("INVOKING LAUNCHDARKLY TEST");
  ldClientStatus().then(console.log);

  // ... the rest of the function ...
```

Upload the lambda. We are assuming you are familiar with the ways of accomplishing this, and for our example all it takes is `npm run update` or `npm run create` for the initial lambda creation; ClaudiaJs is used under the hood to handle all the complexities.  What we want to see at the end is LD giving information about the stream connection.
 ![Upload get-orders sanity for ldClient](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/atyusdvpjunnnry76g8g.png)

We use the [VsCode REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) - or any API test utility - to send a request for `GET {{base}}/orders`.

![Sanity test ldClient](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/fkpzbl6slaz14jf07ovt.png)

Once we see the LD info and the log `Initialization Successful` at CloudWatch logs , then we have proof that the setup is working.

![CloudWatch GET sanity](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2yqdr2knaf7djk2w9snd.png)

### Add a FF to `update-order` handler

There are a few approaches in LD docs, but we like the recipe at the [LD with TS blog post](https://launchdarkly.com/blog/using-launchdarkly-with-typescript/) the best.

```js
// handlers/update-order.js

// ... other imports ...

// require launchdarkly-node-server-sdk
const ld = require("launchdarkly-node-server-sdk");

// ldClient holds a copy of the LaunchDarkly client 
// that will be returned once the SDK is initialized
let ldClient;

/** Handles the initialization using the SDK key,
 * which is available on the account settings in the LaunchDarkly dashboard.
 * Once the client is initialized, getClient() returns it. */
async function getClient() {
  const client = ld.init("sdk-****");
  await client.waitForInitialization();
  return client;
}

/** A generic wrapper around the client's variation() method 
 used to get a flag's current value
 * Initializes the client if it doesn't exist, else reuses the existing client.
 * Populates an anonymous user key if one is not provided for user targeting. */
async function getFlagValue(key, user, defaultValue = false) {
  if (!ldClient) ldClient = await getClient();

  if (!user) {
    user = {
      key: "anonymous",
    };
  }

  return ldClient.variation(key, user, defaultValue);
}

function updateOrder(orderId, options) {
  console.log("Update an order", orderId);

  getFlagValue("update-order").then((flagValue) => {
    console.log("FEATURE FLAG VALUE IS:", flagValue);
  });

  // ... the rest of the handler code ...
```

There is a key enabler for stateless testing in `getFlagValue` arguments; the second argument which is the user. Recall how we switched to an `anonymous user` in the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part2-testing-2c72) and that caused a random localstorage variable to be created by LD upon visiting a web page in a UI application. Mirroring that idea on an API, we want the user to be randomized / anonymous on every invocation of the lambda. To make stateless testing easier later, we will leave the user argument out. The docs indicate the following:

*@param `user` : The end user requesting the flag. The client will generate an analytics event to register this user with LaunchDarkly if the user does not already exist.*

Proceed to turn on the flag at the LD interface.

![update flag on](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8g6f0m4rqypczspk9euk.png)

Deploy the lambda with `npm run update`. Use the rest client to update an order. We should be getting a 200 response, and seeing the value of the flag at AWS CloudWatch, whether the flag value is true or false.

![CloudWatch: functions at handler](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qmy1pxs7frlk9caj7eob.png)

### Reusable module to get flag values

There are two challenges with our code. First, we would have to duplicate it in any other handler that is using feature flags. Second, the `ldClient` variable being in the global scope is not optimal.

// TODO: use better naming for the function so that there is no overlap later with cypress-ld-control-later. Instead of getFlagValue, something to indicate that the value is coming from the LD instance.

What if we could put it all in a module, from which we could import the utility function `getFlagValue` to any handler? What if the handler calling our utility function had exclusive access to the LaunchDarkly client without any other part of the application knowing about it? Let's see how that can work. Create a new file `get-flag-value.js`.

We use an IIFE and wrap the module so that `ldClient` cannot be observed by any other part of the application. This way, the handler has exclusive access to the LaunchDarkly client. Additionally, the instance of `ldClient` gets stored in the module scope. It gets reused by the handler in case the flag does not change value and it is called back to back.

```js
// ./handlers/get-flag-value.js

const ld = require("launchdarkly-node-server-sdk");

const getFlagValue = (function () {
  let ldClient;

  async function getClient() {
    const client = ld.init("sdk-***");
    await client.waitForInitialization();
    return client;
  }

  async function flagValue(key, user, defaultValue = false) {
    if (!ldClient) ldClient = await getClient();

    if (!user) {
      user = {
        key: "anonymous",
      };
    }

    return ldClient.variation(key, user, defaultValue);
  }

  return flagValue;
})();

module.exports = getFlagValue;

```

Import our utility function at our handler, and use the constant with any kind of logic. For our example, if the flag is true, we update the order as usual. If the flag is off, we return information about the request letting the requester know that we received it, and we let them know that the feature is not available.

The final version of our handler should look like the below

```js
const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const docClient = new AWS.DynamoDB.DocumentClient();
const getFlagValue = require("./get-flag-value");

async function updateOrder(orderId, options) {
  // we acquire the flag value
  const FF_UPDATE_ORDER = await getFlagValue("update-order");

  console.log("You tried to Update the order: ", orderId);
  console.log("The flag value is: ", FF_UPDATE_ORDER);

  if (!options || !options.pizza || !options.address) {
    throw new Error("Both pizza and address are required to update an order");
  }

  // once we have the flag value, any logic is possible
  if (FF_UPDATE_ORDER) {
    return docClient
      .update({
        TableName: "pizza-orders",
        Key: {
          orderId: orderId,
        },
        // Describe how the update will modify attributes of an order
        UpdateExpression: "set pizza = :p, address = :a", 
        ExpressionAttributeValues: {
          // Provide the values to the UpdateExpression expression
          ":p": options.pizza,
          ":a": options.address,
        },
        // Tell DynamoDB that you want a whole new item to be returned
        ReturnValues: "ALL_NEW", 
      })
      .promise()
      .then((result) => {
        console.log("Order is updated!", result);
        return result.Attributes;
      })
      .catch((updateError) => {
        console.log(`Oops, order is not updated :(`, updateError);
        throw updateError;
      });
  } else {
    console.log("Update order feature is disabled");
    return {
      orderId: orderId,
      pizza: options.pizza,
      address: options.address,
    };
  }
}

module.exports = updateOrder;
```

Update the lambda with `npm run update`. Set the flag to true and send a request using rest client. The feedback should look like the below

![Flag true](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/hmmhjdrezhsg42139zv9.png)

Toggle the flag value to false at the LD interface. Send another PUT request using rest client. We should be getting the below feedback

![Flag false](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/r6j8vn783arhm24zrwd5.png)

Notice that when we toggled the flag, we did not have to deploy our lambda again. **This why feature flagging is the future of continuous delivery; we control what the users see through LaunchDarkly interface, completely de-coupling deployment from deliver**y.

## Setup environment variables

### Gather the values from the LD interface

In preparation for the test section of this guide, we gather all the values we need from the LD interface.

We get the project key (`pizza-api-example`) and the SDK key from the Projects tab.

![Projects tab](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/6tzpfp4tq6xu3nklreqv.png)

We create an Auth token for our api at Authorization tab. It needs to be an Admin token. We can name it the same as the project; `pizza-api-example`.

![Project token](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qfoxgxfzsi56w25txpxg.png)

#### Local env vars and `process.env`

We can use [dotenv](https://www.npmjs.com/package/dotenv) to have access to `process.env` in our Node code.  `npm i dotenv` and create a gitignored `.env` file in the root of your project. Note that `dotenv` has to be a project dependency because we need it in the source code.

Per convention, we can create a `.env.example` file in the root, and that should communicate to repo users that they need an `.env` file with real values in place of wildcards.

```
LAUNCHDARKLY_SDK_KEY=sdk-***
LAUNCH_DARKLY_PROJECT_KEY=pizza-api-example
LAUNCH_DARKLY_AUTH_TOKEN=api-***
```

#### Lambda env vars

Navigate to our lambda function in AWS > Configuration > Environment variables and add `LAUNCHDARKLY_SDK_KEY`. This is the only environment variable that gets used in the code. The trio of environment variables get used in the tests and will be needed later in Github & CI yml file settings.

 ![Lambda env vars](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/suchvk1lncv2053wjyk3.png)

Now we can update our two handler files that are using the SDK key. In order to use `dotenv` and gain access to `process.env`, all we need is to require it.

```js
// ./handlers/get-flag-value.js

const ld = require("launchdarkly-node-server-sdk");
// require dotenv
require("dotenv").config();

const getFlagValue = (function () {
  let ldClient;

  async function getClient() {
    // the only other relevant change is the SDK key
    const client = ld.init(process.env.LAUNCHDARKLY_SDK_KEY);
    await client.waitForInitialization();
    return client;
  }
```

In case you still want to keep the sanity test in `get-orders` handler, update that too.

```js

// ./handlers/get-orders.js

// ... other imports ...
const ld = require("launchdarkly-node-server-sdk");
require("dotenv").config();

const ldClient = ld.init(process.env.LAUNCHDARKLY_SDK_KEY);
```

As usual, we deploy our code with `npm run update`, set the flag value at LD interface, send a request with rest client, observe the results at CloudWatch. Toggle the flag and repeat the test to ensure basic sanity.

## Summary

In this guide we covered LaunchDarkly Feature Flag setup for Node lambda functions. We created a project and a boolean feature flag at the LD interface. We showcased preferred best practices setting up and using `launchdarkly-node-server-sdk` in a lambda. Finally we demoed a fully working example for a mid sized service and provided reproducible source code.

In the next section we will explore how to test our service while it is being controlled by feature flags.

## References

* <https://docs.launchdarkly.com/sdk/server-side/node-js>

* <https://docs.launchdarkly.com/guides/platform-specific/aws-lambda/?q=lambda>

* <https://launchdarkly.com/blog/using-launchdarkly-with-typescript/>

__________________

## E2e Testing Feature Flags

### Cypress Setup

Before diving into testing feature flags, we will setup Cypress and transfer over the final CRUD e2e spec from the repo [cypress-crud-api-test](https://github.com/muratkeremozcan/cypress-crud-api-test). That repo was featured in the blog post [CRUD API testing a deployed service with Cypress](https://dev.to/muratkeremozcan/crud-api-testing-a-deployed-service-with-cypress-using-cy-api-spok-cypress-data-session-cypress-each-4mlg). Note that the said repo and this service used to be separate repositories - that is a known anti-pattern - and now we are combining the two in a whole new one. The change will provide us with the ability to use the LaunchDarkly instance to make flag state assertions. We would not have that capability if the test code was in a separate repo than the source code, unless the common code was moved to a  package & was imported to the separate development and test repos. In the real world if we had to apply that solution, we would want to have valuable trade-offs.

> From our experience, one example of a valid trade-off for having the tests in a different repo than the source code is when the same test code is shared by multiple source code repositories, thereby eliminating the need to duplicate the test suite.

The branch prior to this work can be checked out at `before-cypress-setup`, and the PR for cypress setup can be found [here](https://github.com/muratkeremozcan/pizza-api/pull/6/files). If you are following along, a practical way to accomplish this section is to copy over the PR.

So far the milestone branches look as such:

1. `before-feature-flags`
2. `ld-ff-setup-test` : where we fully setup the node SDK for our lambda and showed it working via rest client.
3. `before-cypress-setup`
4. `cypress-setup`: the branch for this section of the guide; [PR](https://github.com/muratkeremozcan/pizza-api/pull/6/files).
5. `after-cypress-setup`: if you want to skip this section, you can start from this branch
6. `ld-ff-ld-e2e `: the branch the blog will be worked on

If you do not want to copy the PR but set up Cypress and move over the code yourself, you can follow along.

In the terminal run `npx @bahmutov/cly init` to scaffold Cypress into the repo. We add the Cypress plugins `npm i -D @bahmutov/cy-api cy-spok cypress-data-session cypress-each jsonwebtoken @withshepherd/faker`.

We copy over the files to mirrored locations, and covert the TS to JS. A painless alternative is to look at the PR and copy over the changes.

* `cypress/support/index.ts`
* `cypress/support/commands.ts`
* `cypress/integration/with-spok.spec.ts`
* `cypress/plugins/index.js`
* `scripts/cypress-token.js`
* `./cypress.json`

To ensure all is in working order, we do another deploy with `npm run update`. We start and execute the tests with `npm run cypress:open`, we verify CloudWatch for the logs regarding the flag value, since PUT is a part of the CRUD operation in the e2e test.

### Controlling FF with `cypress-ld-control` plugin

My friend Gleb Bahmutov authored an [excellent blog](https://glebbahmutov.com/blog/cypress-and-launchdarkly/) on testing LD with Cypress, there he revealed his new plugin [cypress-ld-control](https://github.com/bahmutov/cypress-ld-control). We used it in [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part2-testing-2c72). The distinction here is using the plugin for a deployed service and the consequential test strategies.

#### Plugin setup

`npm i -D cypress-ld-control` to add the plugin. 

Getting ready for this section, previously we took note of the LD auth token, installed `dotenv` and saved environment variables in the `.env` file. Here is how the `.env` file should look with your SDK key and auth token:

```
LAUNCHDARKLY_SDK_KEY=sdk-***
LAUNCH_DARKLY_PROJECT_KEY=pizza-api-example
LAUNCH_DARKLY_AUTH_TOKEN=api-***
```

The [cypress-ld-control](https://github.com/bahmutov/cypress-ld-control) plugin utilizes [cy.task](https://docs.cypress.io/api/commands/task), which allows Node code to execute within Cypress context. Therefore we will not be able to use `cypress.env.json` to store these LD related environment variables locally. Consequently we are using .env and declaring the auth token. Initially the plugins file should be setup as such:

```js
// cypress/plugins/index.js

/// <reference types="cypress" />

const cyDataSession = require("cypress-data-session/src/plugin");
const token = require("../../scripts/cypress-token");
// cypress-ld-control setup
const { initLaunchDarklyApiTasks } = require("cypress-ld-control");
require("dotenv").config();

module.exports = (on, config) => {
  const combinedTasks = {
    // add your other Cypress tasks if any
    token: () => token,
    log(x) {
      // prints into the terminal's console
      console.log(x);
      return null;
    },
  };

  // if no env vars, don't load the plugin
  if (
    process.env.LAUNCH_DARKLY_PROJECT_KEY &&
    process.env.LAUNCH_DARKLY_AUTH_TOKEN
  ) {
    const ldApiTasks = initLaunchDarklyApiTasks({
      projectKey: process.env.LAUNCH_DARKLY_PROJECT_KEY,
      authToken: process.env.LAUNCH_DARKLY_AUTH_TOKEN,
      environment: "test", // the name of your environment to use
    });
    // copy all LaunchDarkly methods as individual tasks
    Object.assign(combinedTasks, ldApiTasks);
    // set an environment variable for specs to use
    // to check if the LaunchDarkly can be controlled
    config.env.launchDarklyApiAvailable = true;
  } else {
    console.log("Skipping cypress-ld-control plugin");
  }

  // register all tasks with Cypress
  on("task", combinedTasks);

  return Object.assign(
    {},
    config, // make sure to return the updated config object
    // add any other plugins here
    cyDataSession(on, config)
  );
};
```

> See other plugin file examples [here](https://github.com/bahmutov/cypress-ld-control/blob/main/cypress/plugins/index.js.) and [here](https://github.com/muratkeremozcan/react-hooks-in-action-with-cypress/blob/main/cypress/plugins/index.js).
>
> Check out the [5 mechanics around cy.task and the plugin file](https://www.youtube.com/watch?v=2HdPreqZhgk&t=279s).

We can quickly setup the CI and include LD project key, LD auth token and LD SDK key as environment variables. We need the first two `for cypress-ld-control`, and we need the SDK key for being able to use the LD client instance in the tests.

```yml
# .github/workflows/main.yml

name: cypress-crud-api-test
on:
  push:
  workflow_dispatch:

# if this branch is pushed back to back, cancel the older branch's workflow
concurrency:
  group: ${{ github.ref }} && ${{ github.workflow }}
  cancel-in-progress: true

jobs:
  test:
    strategy:
      # uses 1 CI machine
      matrix:
        machines: [1]
    runs-on: ubuntu-20.04
    steps:
      - name: Checkout 🛎
        uses: actions/checkout@v2

      # https://github.com/cypress-io/github-action
      - name: Run api tests 🧪
        uses: cypress-io/github-action@v3.0.2
        with:
          browser: chrome
          record: true
          group: crud api test
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          LAUNCH_DARKLY_PROJECT_KEY: ${{ secrets.LAUNCH_DARKLY_PROJECT_KEY }}
          LAUNCH_DARKLY_AUTH_TOKEN: ${{ secrets.LAUNCH_DARKLY_AUTH_TOKEN }}
          LAUNCHDARKLY_SDK_KEY: ${{ secrets.LAUNCHDARKLY_SDK_KEY }} #{{
      
			# Here we are running the unit tests after the e2e
			# taking advantage of npm install in Cypress GHA.
			# Ideally we install first, and carry over the cache
			# to unit and e2e jobs.
			# Check this link for the better way:
			# https://github.com/muratkeremozcan/react-hooks-in-action-with-cypress/blob/main/.github/workflows/main.yml
      - name: run unit tests
        run: npm run test
```

We can quickly setup Cypress Dashboard, and create the project:

![Cypress Dashboard project setup](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/3kioueq7aw8nmwar0wup.png)

Grab the projectId (gets copied to `cypress.json`) and the record key (gets copied to Github secrets).

![Project id and record key](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/1lq333pb06kymrvfwcax.png)

Configure the GitHub repo secrets at Settings > Actions  > Action Secrets.

![GHA secrets](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qu8k9vvg99s1lpp3fvao.png)

Because of eventual consistency, when testing lambdas we prefer to increase the default command timeout from 4 to 10 seconds. We also add retries for good measure. Here is how `cypress.json` looks:

```js
{
  "projectId": "4q6j7j",
  "baseUrl": "https://2afo7guwib.execute-api.us-east-1.amazonaws.com/latest",
  "viewportWidth": 1000,
  "retries": {
    "runMode": 2,
    "openMode": 0
  },
  "defaultCommandTimeout": 10000
}
```

> Cypress has 3 levels of retries; function level, api level, and CI level. It is not only a great tool for UI e2e testing handling [network requests in a web app](https://docs.cypress.io/guides/guides/network-requests#Testing-Strategies), but it is also a great api testing framework thanks to [cy.request](https://docs.cypress.io/api/commands/request#Syntax). Check out the post [API e2e testing event driven systems](https://dev.to/muratkeremozcan/api-testing-event-driven-systems-7fe) for a better perspective.

#### [`cypress-ld-control`](https://github.com/bahmutov/cypress-ld-control)plugin in action

[The plugin API](https://github.com/bahmutov/cypress-ld-control#api) provides these functions:

- getFeatureFlags
- getFeatureFlag
- setFeatureFlagForUser
- removeUserTarget
- removeTarget (works like a deleteAll version of the previous)

The idempotent calls are safe anywhere:

```js
// cypress/integration/feature-flags/ff-sanity.spec.js

it("get flags", () => {
  // get one flag
  cy.task("cypress-ld-control:getFeatureFlag", "update-order").then(
    console.log
  );
  
  // get all flags (in an array)
  cy.task("cypress-ld-control:getFeatureFlags").then(console.log);
});
```

The sanity test confirms the flag configuration we have at the LD interface.

![FF sanity](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/sf4dzxkd6osn8n4tahfx.png)

We like making helper functions out of the frequently used plugin commands. In Cypress, `cy.task` cannot be used inside a command, but it is perfectly fine in a utility function. We add some logging to make the test runner easier to reason about. You can reuse these utilities anywhere.

```js
// cypress/support/ff-helper.js

import { datatype, name } from "@withshepherd/faker";

/** Used for stateless testing in our examples.
It may not be needed other projects */
export const randomUserId = `FF_${name
  .firstName()
  .toLowerCase()}${datatype.number()}`;

/**
 * Gets a feature flag by name
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * ```js
 * getFeatureFlag("update-order")
 * ```
 */
export const getFeatureFlag = (featureFlagKey) =>
  cy.log(`**getFeatureFlag** flag: ${featureFlagKey}`)
    .task("cypress-ld-control:getFeatureFlag", featureFlagKey);

/**
 * Gets all feature flags
 * @returns {Array}
 * ```js
 * getFeatureFlags()
 * ```
 */
export const getFeatureFlags = () =>
  cy.log("**getFeatureFlags**").task("cypress-ld-control:getFeatureFlags");

/**
 * Sets a feature flag variation for a user.
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * @param userId LD user id, for anonymous users it is randomly set
 * @param variationIndex index of the flag; 0 and 1 for boolean, can be more for string, number or Json flag variants
 * ```js
 * setFlagVariation(featureFlagKey, userId, 0)
 * ```
 */
export const setFlagVariation = (featureFlagKey, userId, variationIndex) =>
  cy.log(`**setFlagVariation** flag: ${featureFlagKey} user: ${userId} variation: ${variationIndex}`)
    .task("cypress-ld-control:setFeatureFlagForUser", {
      featureFlagKey,
      userId,
      variationIndex,
    });

/**
 * Removes feature flag for a user.
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * @param userId LD user id, for anonymous users it is randomly set
 * ```js
 * removeUserTarget(featureFlagKey, userId)
 * ```
 */
export const removeUserTarget = (featureFlagKey, userId) =>
  cy.log(`**removeUserTarget** flag: ${featureFlagKey} user: ${userId}`)
    .task("cypress-ld-control:removeUserTarget", {
      featureFlagKey,
      userId,
    });

/**
 * Can be used like a deleteAll in case we have multiple users being targeted
 * @param featureFlagKey
 * @param targetIndex
 * ```js
 * removeTarget(featureFlagKey)
 * ```
 */
export const removeTarget = (featureFlagKey, targetIndex = 0) =>
  cy.log(`**removeTarget** flag: ${featureFlagKey} targetIndex:${targetIndex}`)
    .task("cypress-ld-control:removeTarget", {
      featureFlagKey,
      targetIndex,
    });
```

We can use the helper functions from now onwards. We are getting all the data from the network, and can even do deeper assertions with `cy-spok`. 

```js
// cypress/integration/feature-flags/ff-sanity.spec.js

import { getFeatureFlags, getFeatureFlag } from "../support/ff-helper";
import spok from "cy-spok";

describe("FF sanity", () => {
  it("should get flags", () => {
    getFeatureFlag("update-order").its("key").should("eq", "update-order");

    getFeatureFlags().its("items.0.key").should("eq", "update-order");
  });

  it("should get flag variations", () => {
    getFeatureFlag("update-order")
      .its("variations")
      .should((variations) => {
        expect(variations[0].value).to.eq(true);
        expect(variations[1].value).to.eq(false);
      });
  });

	it('should make deeper assertions with spok', () => {

    getFeatureFlag("update-order")
      .its("variations")
      .should(
        spok([
          {
						description: "PUT endpoint available",
            value: true,
          },
          {
						description: "PUT endpoint is not available",
            value: false,
          },
        ])
      );
	})
});
```

Spok is great for mirroring the data we get from the wire into concise, comprehensive and flexible assertions. Here the data is just an array of objects.

![spok data](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ci6vmvtw1q9qiamaz28n.png)

#### Using enums for flag values

We are using the the string `update-order` often. In the previous blog where the flag was setup, we even used it at the lambda `./handlers/update-order.js`. When there are so many flags in our code base, it is possible to use an incorrect string. It would be great if we had a central location of flags, we imported those enums and could only get the flag name wrong in one spot.

There are a few benefits of using enums and having variable convention to hold their values:

- We have a high level view of all our flags since they are at a central location.
- We cannot get them wrong while using the flags in lambdas or tests; string vs enum.
- In any file it would be clear which flags are relevant.
- It would be easy to search for the flags and where they are used, which makes implementation and maintenance seamless.


In JS `Object.freeze` can be used to replicate TS' enum behavior. Now is also a good time to move the `get-flag-value.js` from `./handlers` into `./flag-utils`, it will make life easier when using the utility for test assertions. Here is the refactor: 

```js
// ./flag-utils/flags.js

const FLAGS = Object.freeze({
  UPDATE_ORDER: 'update-order'
})
module.exports = {
  FLAGS
};


// At the spec file import the constant & replace the string arg
// ./cypress/integration/feature-flags/ff-sanity.spec.js
import { FLAGS } from "../../flag-utils/flags";

it("should get flags", () => {
  getFeatureFlag(FLAGS.UPDATE_ORDER)
  // ...


// At the handler file, do the same
// ./handlers/update-order.js
const getFlagValue = require("../ff-utils/get-flag-value");
const { FLAGS } = require("../flag-utils/flags");

async function updateOrder(orderId, options) {
  const FF_UPDATE_ORDER = await getFlagValue(FLAGS.UPDATE_ORDER);
  //...
```

After the refactor, we can quickly deploy the code with `npm run update` and run the run the tests with `npm run cy:run`. Having API e2e tests for lambda functions gives us confidence on the code as well as deployment quality.

#### `setFlagVariation` enables a stateless approach

At first it may not be obvious from `cypress-ld-control` [api docs](https://github.com/bahmutov/cypress-ld-control#api) , but `setFeatureFlagForUser` takes a `userId` argument and **creates that userId if it does not exist**. If we use an arbitrary string, that key will appear on the LD Targeting tab. In case we are not using randomized users, emails or other randomized entities in our tests, we can utilize a function for generating random flag user ids. We can prefix that with `FF_` so that if there is any clean up needed later in flag management, those specific users can be cleared easily from the LD interface.

> Any maintenance work about cleaning flags from the code or users from the LD interface involves the `FF_` prefix.

```js
// ./cypress/support/ff-helper.js
import { datatype, name } from "@withshepherd/faker";

export const randomUserId = `FF_${name
  .firstName()
  .toLowerCase()}${datatype.number()}`;
```

```js
// cypress/integration/feature-flags/ff-sanity.spec.js

it.only("should set the flag for a random user", () => {
  setFlagVariation(FLAGS.UPDATE_ORDER, randomUserId, 0);
});
```

Setting the flag by the user, we can view the flag being set to this targeted individual. It would be trivial to randomize a user per test and target them. How can we prove that all other users still get served one value, while the targeted user gets served another?

### Reading FF state using the test plugin vs the LD client instance

// TODO: update the file name if it changes
Recall our flag utility at `./flag-utils/get-flag-value` which we also use in the lambda handler. At a high level it gets the flag value using the LD client, and makes abstractions under the hood:

1. Gets the flag value using the LD client.
2. Initializes the LD client if it doesn't exist, else reuses the existing client.
3. Waits for the initialization to complete.
4. If a user is not provided while getting the flag value, populates an anonymous user for user-targeting.
5. The code calling the LD client cannot be observed by any other part of the application and is reused by the handler when it is called back to back without the flag changing value.

That is a very useful bit of code, and the part we need for test assertions is **how it can get the flag value for a targeted user, versus all other users**. 

We can run any Node code within Cypress context via `cy.task`. Let's import `getFlagValue` to our plugins file at`cypress/plugins/index.js` and add it as a Cypress task.

Our original `getFlagValue` function took three arguments (*key*, *user*, *defaultValue*). There is a key bit of knowledge needed to convert it to a task. When `cy.task` calls a function without any arguments, life is easy; `cy.task('functionName')` When `cy.task` calls a function with a single argument things are simple; `cy.task('functionName', arg)`. When there are multiple arguments, we have to wrap them in an object; `cy.task('functionName', { arg1Name: arg1Value, arg2Name: arg2Value  })`. In the below code `(...args)` just means `(key, user, defaultValue)`, we are taking a shorthand and also working with the `cy.task` concerns.

```js
// ./cypress/plugins/index.js

const getFlagValue = require("../flag-utils/get-flag-value");
// ... other imports

module.exports = (on, config) => {
  const combinedTasks = {
    token: () => token,
    log(x) {
      console.log(x);
      return null;
    },
    // we can use the same function within Cypress context
    getFlagValue: (...args) => {
      console.log("args are : ", ...args); 
      return getFlagValue(...args); 
    },
  };
  
  // ... the rest of the file
```

We will use the LD client instance to confirm the flag state for a targeted user vs generic users. When we run that task in a basic test

```js
// ./cypress/integration/feature-flags/ff-sanity.spec.js

it.only("should get a different flag value for a specified user", () => {
  setFlagVariation(FLAGS.UPDATE_ORDER, "foo", 1);

  cy.log("**getFlagValue(key)** : gets value for any other user");
  cy.task("getFlagValue", FLAGS.UPDATE_ORDER).then(cy.log);

  cy.log("**getFlagValue(key, user)** : just gets the value for that user");
  cy.task("getFlagValue", { keys: FLAGS.UPDATE_ORDER, user: "foo" }).then(
    cy.log
  );
});
```

**KEY:** Executing that code, we realize the enabler for stateless feature flag testing. We prove that the flag can be set for a targeted user, that value can be read by our `getFlagValue` lambda utility using the LD client, which can either focus on the targeted user or any other generic user while reading our flag. **That ability can fully de-couple feature flag testing from feature flag management**.

> In contrast, in a front-end application the key enabler for stateless testing was targeting anonymous users and the user's id - `ld:$anonUserId`  - getting created by LD in local storage.

![Stateless test 1](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/fl8oln5kug2hx279j4r9.png)

As a bonus, we can confirm our `cy.task` setup; when calling the task with a single arg (*reading the flag value for generic users*) and when calling the task with multiple args (*reading the flag value for a targeted user*).

![console.log cy.task args](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ye801cmsiuhzi8aspbbx.png)

`cypress-ld-control` plugin allows us to set a flag for a targeted user. If it allowed changing the flag value for everyone, mutating a shared state for every flag reader would not be ideal. On the other hand, the plugin can only be used to get the flag value for generic users vs a targeted user. *(If Gleb disagrees or adds support for it later, we stand corrected)*. Reading the flag value for a targeted user wasn't a need when feature flag testing a UI application; while using anonymous users LD would set local storage with `ld:$anonUserId` enabling a unique browser instance which would we would make UI assertions against. Consequently, `getFlagValue` lambda utility using the LD client instance is also needed for user-targeted test assertions when statelessly testing feature flags in deployed services.

Here is the high level summary of our feature flag testing tool set:

`cypress-ld-control` test plugin:

* Our primary tool to set a feature flag: `setFlagVariation('my-flag', 'user123', 1)`

* Our primary tool to clean up feature flags: `removeUserTarget('my-flag', 'user123')`

* Can read the flag value for generic users: `getFeatureFlag('my-flag'`)

  

`getFlagValue` LD client instance:

* Our primary Feature Flag development enabler, used to read flag state.

* In tests, it can read the flag value for generic users: `cy.task('getFlagValue', 'my-flag')`

* In tests, it can read the flag value for a targeted user:  `cy.task('getFlagValue', { keys: 'my-flag', user: 'user123' })`

  

Let's prove out the theory and show a harmonious usage of these utilities in a succinct test. 

```js
  context("flag toggle using the test plugin", () => {
    const DEFAULT_RULE_TRUE = 0; // generic users get this
    const TARGETED_RULE_FALSE = 1; // targeted users get this

    // setup
    beforeEach("set flag variation for a targeted user", () =>
      setFlagVariation(FLAGS.UPDATE_ORDER, randomUserId, TARGETED_RULE_FALSE)
    );

    // clean up: afterEach runs even if there is an it block failure
    afterEach("user-targeted-flag clean up", () =>
      removeUserTarget(FLAGS.UPDATE_ORDER, randomUserId)
    );

    it("should get the flag value for generic users using Cypress test plugin", () => {
      getFeatureFlag(FLAGS.UPDATE_ORDER)
        .its("environments.test.fallthrough.variation")
        .should("eq", DEFAULT_RULE_TRUE);
    });

    it("should get the flag value for generic users vs the targeted user using the LD client instance", () => {
      cy.log("generic users");
      cy.task("getFlagValue", FLAGS.UPDATE_ORDER).should("eq", true);

      cy.log("targeted user");
      cy.task("getFlagValue", {
        keys: FLAGS.UPDATE_ORDER,
        user: randomUserId,
      }).should("eq", false);
    });
  });
});
```

Now that we have a complete suite reading and writing feature flags, we can refactor to our heart's content. Good e2e tests are such a luxury, we can try daring code changes, get code level, deployment level and test level confidence.

```js
// ./cypress/plugins/index.js

// shorthand
const combinedTasks = {
  token: () => token,
  log(x) {
    console.log(x);
    return null;
  },
  getFlagValue: (...args) => getFlagValue(...args),
};

// FP point-free style; we don't need any args!
const combinedTasks = {
  token: () => token,
  log(x) {
    console.log(x);
    return null;
  },
  getFlagValue
};

```

### Test strategies

Now that we have stateless feature flag setting & removing capabilities coupled with feature flag value reading - which is an idempotent operation - how can we use them in e2e tests? In the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part2-testing-2c72) there were effectively two strategies; stub the network & test and control the flag & test. With an API client we can do the latter the same way. There is no stubbing the network however, what other approach can we have?

#### Conditional execution: get flag state, run conditionally 

Although conditional testing is usually an anti-pattern, when testing feature flags in a deployed service  it gives us a read-only, idempotent approach worth exploring. After all we have to have some maintenance-free, non-feature flag related tests that need to work in every deployment regardless of flag states. Let's focus on our CRUD e2e test for the API `cypress/integration/with-spok.spec.js` where we have the flagged Update feature. 

##### Wrap the test code inside the it block with a conditional

We can wrap the relevant part of the test with a conditional driven by the flag value:

```js
cy.task("getFlagValue", FLAGS.UPDATE_ORDER).then((flagValue) => {
  if (flagValue) {
    cy.updateOrder(token, orderId, putPayload)
      .its("body")
      .should(satisfyAssertions);
  } else {
    cy.log('**the flag is disabled, so the update will not be done**');
  }
});
```

With this tweak, our specs which are not flag relevant will work on any deployment regardless of flag status.

![Flag condition inside it block](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dayff6sc0blkei9ok3vg.png)

![Flag enabled inside it block](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/fdldvh900tmrgajwssas.png)

##### Disable / Enable a describe/context/it block or the entire test

We can take advantage of another one of Gleb's fantastic plugins [cypress-skip-test](https://github.com/cypress-io/cypress-skip-test/blob/master/README.md). `npm install -D @cypress/skip-test` and Add the below line to `cypress/support/index.js:`

```js
require('@cypress/skip-test/support')
```

It has a key feature which allows us to run Cypress commands before deciding to skip or continue. We can utilize it in a describe / context / it block, but if we want to disable the whole suite without running anything, inside the before block is the way to go.

```js
  before(() => {
    cy.task("token").then((t) => (token = t));
    cy.task("getFlagValue", FLAGS.UPDATE_ORDER).then((flagValue) =>
      cy.onlyOn(flagValue === true)
    );
  });
```

Toggle the flag on, and things work as normal:

![onlyOn flag === true](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/1ayzet39z9u0l2zoxbr5.png)

If the flag is off, the test is skipped.

![onlyOn flag === false](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/71cowpmvmpykuyjoa5iq.png)

Here is the entire spec:

```js
/// <reference types="cypress"/>
// @ts-nocheck

import spok from "cy-spok";
import { datatype, address } from "@withshepherd/faker";
import { FLAGS } from "../../flag-utils/flags";

describe("Crud operations with cy spok", () => {
  let token;
  before(() => {
    cy.task("token").then((t) => (token = t));
    // we can control the the entire test, 
    // a describe / context / it block with cy.onlyOn or cy.skipOn
    // Note that it is redundant to have the 2 variants of flag-conditionals in the same test
    // they are both enabled here for easier blog readbility
    cy.task("getFlagValue", FLAGS.UPDATE_ORDER).then((flagValue) =>
      cy.onlyOn(flagValue === true)
    );
  });

  const pizzaId = datatype.number();
  const editedPizzaId = +pizzaId;
  const postPayload = { pizza: pizzaId, address: address.streetAddress() };
  const putPayload = {
    pizza: editedPizzaId,
    address: address.streetAddress(),
  };

  // the common properties between the assertions
  const commonProperties = {
    address: spok.string,
    orderId: spok.test(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/), // regex pattern to match any id
    status: (s) => expect(s).to.be.oneOf(["pending", "delivered"]),
  };

  // common spok assertions between put and get
  const satisfyAssertions = spok({
    pizza: editedPizzaId,
    ...commonProperties,
  });

  it("cruds an order, uses spok assertions", () => {
    cy.task("log", "HELLO!");

    cy.createOrder(token, postPayload).its("status").should("eq", 201);

    cy.getOrders(token)
      .should((res) => expect(res.status).to.eq(200))
      .its("body")
      .then((orders) => {
        const ourPizza = Cypress._.filter(
          orders,
          (order) => order.pizza === pizzaId
        );
        cy.wrap(ourPizza.length).should("eq", 1);
        const orderId = ourPizza[0].orderId;

        cy.getOrder(token, orderId)
          .its("body")
          .should(
            spok({
              pizza: pizzaId,
              ...commonProperties,
            })
          );

        cy.log(
          "**wrap the relevant functionality in the flag value, only run if the flag is enabled**"
        );
        cy.task("getFlagValue", FLAGS.UPDATE_ORDER).then((flagValue) => {
          if (flagValue) {
            cy.log("**the flag is enabled, updating now**");
            cy.updateOrder(token, orderId, putPayload)
              .its("body")
              .should(satisfyAssertions);
          } else {
            cy.log("**the flag is disabled, so the update will not be done**");
          }
        });

        cy.getOrder(token, orderId).its("body").should(satisfyAssertions);

        cy.deleteOrder(token, orderId).its("status").should("eq", 200);
      });
  });
});

```



#### Controlled flag: set flag and run test

We also want to gain confidence that no matter how flags are controlled in any environment, they will work with our service. This will enable us to fully de-couple the testing of feature flags from the management of feature flags, thereby de-coupling continuous deployment from continuous delivery. The key here is to be able control and verify the flag state for a scoped user.

Similar to the UI approach, we can set flag the feature flag in the beginning of a test and clean up at the end. This would be an exclusive feature flag test which we only need to run on one deployment; if we can control and verify the flag value's consequences on one deployment, things will work the same on any deployment. Later, the spec would be converted to a permanent one, where which we can tweak it to not need flag controls, or the spec can get removed entirely. Therefore it is a good practice to house the spec under `./cypress/integration/feature-flags` and control in which deployment it executes with config files using `ignoreTestFiles` property in the json. 

In our example demoing this test would require a token and user scope; create a pizza for a scoped user and try to update the pizza as that user. Since we did not implement authorization to our lambda, this test is not able to be shown in a satisfactory manner. We can set the flag for a user but since the update is not scoped to that user, verifying whether that user can update a pizza or not is not possible.  We are confident that the test scenario will be trivial in the real world where APIs are secured and tokens are scoped to users. 

















