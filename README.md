# pizza-api

Sample repo for a lambda service using serverless Node and ClaudiaJs. 

>  The api is used in the blog post [CRUD API testing a deployed service with Cypress](https://dev.to/muratkeremozcan/crud-api-testing-a-deployed-service-with-cypress-using-cy-api-spok-cypress-data-session-cypress-each-4mlg), which also is accompanied by a GitHub repo [cypress-crud-api-test](https://github.com/muratkeremozcan/cypress-crud-api-test). While it is not recommended to have the source code and tests in different repos, for a case study this is ok; the ideas still apply the same way in a proper repository with tests and the code together. In the future, we plan have a more complete example with multiple micro services communicating, with the source code and tests together, a pyramid of e2e, consumer driven contract, and unit tests, using generic tech like Node, TypeScript, AWS cdk, Jest that are more familiar with the wider audience.

The below is a draft  guide on e2e testing Launch Darkly feature flags.  A version of the app prior to the  feature flag setup can be checked out at the branch `before-feature-flags`. 

## LaunchDarkly (LD) feature flags (FF)

There are two key resources from LD:

* https://docs.launchdarkly.com/sdk/server-side/node-js

* https://docs.launchdarkly.com/guides/platform-specific/aws-lambda/?q=lambda

The below is a distilled version of that knowledge applied to a sample API. Throughout the setup there will be references to the UI app variant of feature flagging in the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part1-the-setup-jfp).

### Create a project at the LD interface

Nav to *https://app.launchdarkly.com/settings/projects > Create project*. Give it any name like `pizza-api-example`, and the rest as default.

![Create project](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/5igpl5cpf4knugljjftm.png)

Two default environments get created for us. You can leave them as is, or  delete one of them for this example.

The critical item to note here is the **SDK key**, since we are not using a client-side ID. Note that in contrast to our Node API, the UI app with React was using the [clientSideID](https://github.com/muratkeremozcan/react-hooks-in-action-with-cypress/blob/main/src/index.js#L8). Enterprise projects apply configuration management to these variables, but for the sake of the example and ease of use, we are using the raw values.

![image-20220515080124188](/Users/murat/Library/Application Support/typora-user-images/image-20220515080124188.png)

### Create a Boolean FF for later use

Nav to https://app.launchdarkly.com/pizza-api-example/test/features/new and create a boolean feature flag named `update-order`. You can leave the settings as default, and enter optional descriptions. We will use the flag to toggle the endpoint `PUT {{baseUrl}}/orders/{{orderId}}`. 

![Create a feature flag](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8uzw38r75pf8l0550n83.png)

## Setup LD FF at our service

Install the LD SDK as a dependency; `npm install launchdarkly-node-server-sdk`.

### LD & lambda function Basic sanity test

Let's start with a simple example, console logging whether LD client initialized successfully. In the handler file  `./handlers/get-orders.js` import the LD client, initialize it, add a simple function to log out the initialization, then invoke it anywhere in the `getOrders()` function.

```js
// ./handlers/get-orders.js

// other imporrts...
const ld = require('launchdarkly-node-server-sdk');
// initialize the LD client
const ldClient = ld.init("sdk-cfcea545-***");
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

Once we see in CloudWatch logs the LD info and the log `Initialization Successful`, then we have proof that all the setup is working.

![CloudWatch GET sanity](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2yqdr2knaf7djk2w9snd.png)

### Wrap `update-order` in a feature flag

There are a few key parts to the recipe:

1. Import and initialize the ldClient
2. Wait for the initialization
3. Get the flag value
4. Do things based on the flag value

```js
// handlers/update-order.js

// (1) Import and initialize the ldClient
const ld = require("launchdarkly-node-server-sdk");
const ldClient = ld.init("sdk-cfcea54-***");

async function updateOrder(orderId, options) {
  // ...

  // (2) Wait for the initialization
  await client.waitForInitialization()

  // (3) Get the flag value: 
  // ldClient.variation(<flag-name>, <user>, <default-flag-value>)
  const FF_UPDATE_ORDER = await ldClient.variation('update-order')
  
  // for test purposes, log out the flag value
  console.log('Flag value is :', FF_UPDATE_ORDER)

  // (4) Do things based on flag value
  if (!FF_UPDATE_ORDER) {
    throw new Error("update-order feature flag is not enabled");
  } 
 
 // otherwise continue...
}

```

There is a key enabler for stateless testing in `ldClient.variation` arguments; the second argument which is the user. Recall how we switched to an `anonymous user` in the blog post [Effective Test Strategies for Front-end Applications using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-testing-front-end-applications-using-launchdarkly-feature-flags-and-cypress-part2-testing-2c72) and that caused a random localstorage variable to be created by LD upon visiting a web page in a UI application. Mirroring that idea on an API, we want the user to be randomized / anonymous on every invocation of the lambda. The docs indicate the following:

*@param `user` : The end user requesting the flag. The client will generate an analytics event to register this user with LaunchDarkly if the user does not already exist.*

We will leave the user argument out.
TODO: double check statelessness, and check if `{ key: *event*.Records[0].cf.request.clientIp },` is better

Turn on the flag at the LD interface.

 ![update flag on](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8g6f0m4rqypczspk9euk.png)

Upload the lambda with `npm run update`.
