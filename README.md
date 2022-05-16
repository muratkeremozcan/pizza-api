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

### Feature flagging the Update handler

Let's say that we want to flag the Update operation in the CRUD.

In the handler file  `./handlers/update-order.js` import the LD client.

```js
// ./handlers/update-order.js

const ld = require('launchdarkly-node-server-sdk');
```

Now we need to create a singleton of the LDClient.

```js
const client = ld.init('sdk-cfcea545-***');
```

Test your setup by initializing LaunchDarkly and returning a response indicating whether it has succeeded or failed.

