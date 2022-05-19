/// <reference types="cypress" />

const getFlagValue = require("../../flag-utils/get-flag-value");
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
    getFlagValue,
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
