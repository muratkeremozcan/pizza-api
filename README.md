Sample repo for a lambda service using serverless Node and ClaudiaJs.

The below is a draft  guide on e2e testing Launch Darkly feature flags.  A version of the app prior to the  feature flag setup can be checked out at the branch `before-feature-flags`. The changes in this PR can be found at the PR [feature flag setup and test](https://github.com/muratkeremozcan/pizza-api/pull/4).

## LaunchDarkly (LD) feature flags (FF)

The below is a distilled version of LD FF setup documentation for Node lambda functions, applied to a sample API. Throughout the setup there will be references to the UI app variant of feature flagging in the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part1-the-setup-jfp).

### Create a project at the LD interface

Nav to *<https://app.launchdarkly.com/settings/projects> > Create project*. Give it any name like `pizza-api-example`, and the rest as default.

![Create project](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/5igpl5cpf4knugljjftm.png)

Two default environments get created for us. We can leave them as is, or  delete one of them for this example.

The critical item to note here is the **SDK key**, since we are not using a client-side ID. Note that in contrast to our Node API here, the UI app with React was using the [clientSideID](https://github.com/muratkeremozcan/react-hooks-in-action-with-cypress/blob/main/src/index.js#L8). Enterprise projects apply configuration management to these variables. In the beginning code samples, we will keep the SKD key as a string. Later we will use `dotenv` to read them from a local `.env` file, and also we will setup the lambda to include any key that is needed.

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

// this is the handler function that was in place prior
function getOrders(orderId) {
  console.log("Get order(s)", orderId);

  console.log("INVOKING LAUNCHDARKLY TEST");
  ldClientStatus().then(console.log);

  // ... the rest of the function ...
```

Upload the lambda. We are assuming you are familiar with the ways of accomplishing this, and for our example all it takes is `npm run update`; ClaudiaJs is used under the hood to handle all the complexities. What we want to see at the end is LD giving information about the stream connection.

> If this is the initial create operation vs an update, the command is `npm run create`. Again, it is assumed you are familiar with creating and updating lambda functions.

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

There is a key enabler for stateless testing in `getFlagValue` arguments; the second argument which is the user. Recall how we switched to an `anonymous user` in the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part2-testing-2c72) and that caused a random localstorage variable to be created by LD upon visiting a web page in a UI application. Mirroring that idea on an API, we want the user to be randomized / anonymous on every invocation of the lambda. The docs indicate the following:

*@param `user` : The end user requesting the flag. The client will generate an analytics event to register this user with LaunchDarkly if the user does not already exist.*

To enable stateless testing, we will leave the user argument out.

Proceed to turn on the flag at the LD interface.

 ![update flag on](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8g6f0m4rqypczspk9euk.png)

Deploy the lambda with `npm run update`.

Use the rest client to update an order. We should be getting a 200 response, and seeing the value of the flag at AWS CloudWatch, whether the flag value is true or false.

![CloudWatch: functions at handler](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qmy1pxs7frlk9caj7eob.png)

### Reusable module to get flag values

There are two challenges with our code. First, we would have to duplicate it in any other handler that is using feature flags. Second, the `ldClient` variable being in the global scope is not optimal.

What if we could put it all in a module, from which we could import the utility function `getFlagValue` to any handler? What if the handler calling our utility function had exclusive access to the LaunchDarkly client without any other part of the application knowing about it? Let's see how that can work. Create a new file `get-flag-value.js`.

We use an IIFE and wrap the module so that `ldClient` cannot be observed by any other part of the application. This way, the handler has exclusive access to the LaunchDarkly client. Additionally, the instance of `ldClient` gets stored in the module scope. It gets reused by the handler in case the flag does not change value and it is called back to back

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
  const FF_UPDATE_ORDER = await getFlagValue("update-order");

  console.log("You tried to Update the order: ", orderId);
  console.log("The flag value is: ", FF_UPDATE_ORDER);

  if (!options || !options.pizza || !options.address) {
    throw new Error("Both pizza and address are required to update an order");
  }

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

Notice that when we toggled the flag, we did not have to deploy our lambda again. This is the magic of feature flags; we control what the users see through LaunchDarkly interface, completely de-coupling deployment from delivery.

## Setup environment variables

### Gather the values from the LD interface

In preparation for the test section of this guide, we gather all the values we need from the LD interface.

We get the project key (`pizza-api-example`) and the SDK key from the Projects tab.

![Projects tab](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/6tzpfp4tq6xu3nklreqv.png)

We create an Auth token for our api at Authorization tab. It needs to be an Admin token. We can name it the same as the project; `pizza-api-example`.

![Project token](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qfoxgxfzsi56w25txpxg.png)

#### Local env vars and `process.env`

We can use [dotenv](https://www.npmjs.com/package/dotenv) to have access to `process.env` in our Node code.  `npm i dotenv` and create a gitignored `.env` file in the root of your project. Note that it has to be a project dependency.

Per convention, we can create a `.env.example` file in the root, and that should communicate to repo users that they need an `.env` file with real values in place of wildcards.

```
LAUNCHDARKLY_SDK_KEY=sdk-***
LAUNCH_DARKLY_PROJECT_KEY=pizza-api-example
LAUNCH_DARKLY_AUTH_TOKEN=api-***
```

#### Lambda env vars

Navigate to our lambda function in AWS > Configuration > Environment variables and add `LAUNCHDARKLY_SDK_KEY`. This is the only environment variable that gets used in the code. The other two get used in the tests and will only be needed later in Github environment variables.

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

In this guide we covered LaunchDarkly Feature Flag setup for Node lambda functions. We created a project and a boolean feature flag at the LD interface. We showcased preferred best practices setting up and using `launchdarkly-node-server-sdk`. Finally we demoed a fully working example for a mid sized service and provided reproducible source code.

In the next section we will explore how to test our service while it is being controlled by feature flags.

## References

* <https://docs.launchdarkly.com/sdk/server-side/node-js>

* <https://docs.launchdarkly.com/guides/platform-specific/aws-lambda/?q=lambda>

* <https://launchdarkly.com/blog/using-launchdarkly-with-typescript/>

__________________

## E2e Testing Feature Flags

### Cypress Setup

Before diving into testing feature flags, we will setup Cypress and transfer over the final CRUD e2e spec from the repo [cypress-crud-api-test](https://github.com/muratkeremozcan/cypress-crud-api-test). That repo was featured in the blog post [CRUD API testing a deployed service with Cypress](https://dev.to/muratkeremozcan/crud-api-testing-a-deployed-service-with-cypress-using-cy-api-spok-cypress-data-session-cypress-each-4mlg). Note that the said repo and this service used to be separate, and now we are combining the two. The branch prior to this work can be checked out at `before-cypress-setup`, and the PR for cypress setup can be found [here](https://github.com/muratkeremozcan/pizza-api/pull/6/files). If you are following along, a practical way to accomplish this section is to copy over the PR.

So far the milestone branches look as such:

1. `before-feature-flags`
2. `ld-ff-setup-test` : where we fully setup the node SDK for our lambda and showed it working via rest client.
3. `before-cypress-setup`
4. `cypress-setup`: the branch for this section of the guide; [PR](https://github.com/muratkeremozcan/pizza-api/pull/6/files).
5. `after-cypress-setup`: if you want to skip this section, you can start from this branch

If you do not want to copy the PR but set up Cypress and move over the code yourself, you can follow along.

In the terminal run `npx @bahmutov/cly init` to scaffold Cypress into the repo. We add the Cypress plugins `npm i -D @bahmutov/cy-api cy-spok cypress-data-session cypress-each jsonwebtoken @withshepherd/faker`.

We copy over the files to mirrored locations, and covert the TS to JS. A painless alternative is to look at the PR and copy over the changes.

* `cypress/support/index.ts`
* `cypress/support/commands.ts`
* `cypress/integration/with-spok.spec.ts`
* `cypress/plugins/index.js`
* `scripts/cypress-token.js`
* `./cypress.json`

To ensure all is in working order, we do another deploy with `npm run update`, we start and execute the tests with `npm run cypress:open`, we check CloudWatch for the logs regarding the flag value, since PUT is a part of the CRUD operation in the e2e test.

### Controlling FF with `cypress-ld-control` plugin

My friend Gleb Bahmutov authored an [excellent blog](https://glebbahmutov.com/blog/cypress-and-launchdarkly/) on testing LD with Cypress, there he revealed his new plugin [cypress-ld-control](https://github.com/bahmutov/cypress-ld-control). We used it in [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part2-testing-2c72).

#### Plugin setup

`npm i -D cypress-ld-control` to add the plugin. 

Getting ready for this section, previous we already took note of the LD auth token, installed `dotenv` and saved environment variables in the `.env` file. Here is how the `.env` file should look with your SDK key and auth token:

```
LAUNCHDARKLY_SDK_KEY=sdk-***
LAUNCH_DARKLY_PROJECT_KEY=pizza-api-example
LAUNCH_DARKLY_AUTH_TOKEN=api-***
```

> The [cypress-ld-control](https://github.com/bahmutov/cypress-ld-control) plugin utilizes [cy.task](https://docs.cypress.io/api/commands/task), which allows node code to execute within Cypress context. Therefore we will not be able to use `cypress.env.json` to store these LD related environment variables locally. Consequently we are using .env and declaring the auth token.

The plugins file should be setup as such:

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

We can quickly setup the CI and include LD project key and LD auth token as environment variables there. Recall from the previous blog post that we noted the SDK key for testing, but we needed it at the lambda function environment.

```yml
# .github/workflows/cypress-crud-api-test.yml

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
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          LAUNCH_DARKLY_PROJECT_KEY: ${{ secrets.LAUNCH_DARKLY_PROJECT_KEY }}
          LAUNCH_DARKLY_AUTH_TOKEN: ${{ secrets.LAUNCH_DARKLY_AUTH_TOKEN }}
```

We can quickly setup Cypress Dashboard, and create the project:

![Cypress Dashboard project setup](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/3kioueq7aw8nmwar0wup.png)

Grab the projectId - gets copied to `cypress.json` and record key - gets copied to `Github Setting ` - from here. 

![Project id and record key](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/1lq333pb06kymrvfwcax.png)

Configure the GitHub repo secrets at Settings > Actions  > Action Secrets, and git push.

![GHA Secrets](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/onls770fw0ob07mzroyr.png)
