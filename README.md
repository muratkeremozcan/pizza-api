
[![main](https://github.com/muratkeremozcan/pizza-api/actions/workflows/main.yml/badge.svg?branch=main&event=push)](https://github.com/muratkeremozcan/pizza-api/actions/workflows/main.yml) [![cypress-crud-api-test](https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/detailed/4q6j7j/main&style=flat&logo=cypress)](https://dashboard.cypress.io/projects/4q6j7j/runs) ![cypress version](https://img.shields.io/badge/cypress-9.6.1-brightgreen) ![cypress-data-session version](https://img.shields.io/badge/cypress--data--session-2.0.0-brightgreen) ![cy-spok version](https://img.shields.io/badge/cy--spok-1.5.2-brightgreen) ![@bahmutov/cy-api version](https://img.shields.io/badge/@bahmutov/cy--api-2.1.3-brightgreen)

[renovate-badge]: https://img.shields.io/badge/renovate-app-blue.svg
[renovate-app]: https://renovateapp.com/

```bash
npm i --registry https://registry.npmjs.org  

# api tests with Cypress
npm run cy:open
npm run cy:run

# unit tests
npm run test

# deploy the lambda
npm run update
```

## Setting up and Testing LaunchDarkly Feature flags

The specs in the launch-darkly folder will not be working until you have a .env file with your LaunchDarkly environment variables. You can add a property to your `cypress.json` file to disable the feature flag tests until you have the environment variables.

`.env`:

```

LAUNCHDARKLY_SDK_KEY=sdk-***
LAUNCH_DARKLY_PROJECT_KEY=pizza-api-example
LAUNCH_DARKLY_AUTH_TOKEN=api-***
```

`cypress.json`

```json
{
  "ignoreTestFiles": "**/feature-flags/*.js"
}
```

Check out the multi-part series:

* [Effective Test Strategies for Deployed NodeJS Services using LaunchDarkly Feature Flags and Cypress. Part1: the setup](https://dev.to/muratkeremozcan/effective-test-strategies-for-deployed-nodejs-services-using-launchdarkly-feature-flags-part1-the-setup-21ji)
* [Effective Test Strategies for Deployed NodeJS Services using LaunchDarkly Feature Flags and Cypress. Part2: testing](https://dev.to/muratkeremozcan/effective-test-strategies-for-deployed-nodejs-services-using-launchdarkly-feature-flags-and-cypress-part2-testing-l49)

The branch saga through the blog series looks like the below:

1. `before-feature-flags`
2. `ld-ff-setup-test` : where we fully setup the node SDK for our lambda and showed it working via rest client.
3. `before-cypress-setup`
4. `cypress-setup` : the branch for this section of the guide; PR.
5. `after-cypress-setup` : if you want to skip this section, you can start from this branch
6. `ld-ff-ld-e2e`: the branch the blog will be worked on
