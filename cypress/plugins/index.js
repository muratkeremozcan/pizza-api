/// <reference types="cypress" />

const getLDFlagValue = require("../../flag-utils/get-ld-flag-value");
const cyDataSession = require("cypress-data-session/src/plugin");
const token = require("../../scripts/cypress-token");
// cypress-ld-control setup
const { initLaunchDarklyApiTasks } = require("cypress-ld-control");
require("dotenv").config();

function isObject(value) {
  const type = typeof value;
  return value != null && (type === "object" || type === "function");
}

module.exports = (on, config) => {
  const combinedTasks = {
    // add your other Cypress tasks if any
    token: () => token,
    log(x) {
      // prints into the terminal's console
      console.log(x);
      return null;
    },
    getLDFlagValue: (arg) => {
      // cy.task api changes whether there is 1 arg or multiple args;
      // it takes a string for a single arg, it takes and object for multiple args.
      // LD client accepts a user object as { key: 'userId' }.
      // We have to do some wrangling to make the api easy to use
      // we want an api like :
      // cy.task('getLDFlagValue', 'my-flag-value' ) for generic users
      // cy.task('getLdFlagValue', { key: 'my-flag-value', userId: 'abc123'  }) for targeted users
      if (isObject(arg)) {
        const { key, userId } = arg;
        console.log(`cy.task args: key: ${key} user.key: ${userId}`);
        return getLDFlagValue(key, { key: userId });
      }
      console.log(`cy.task arg: ${arg}`);
      return getLDFlagValue(arg);
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
