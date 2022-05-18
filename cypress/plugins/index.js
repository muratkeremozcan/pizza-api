/// <reference types="cypress" />

const cyDataSession = require("cypress-data-session/src/plugin");
const token = require("../../scripts/cypress-token");

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  on("task", token);

  on("task", {
    log(x) {
      // prints into the terminal's console
      console.log(x);

      return null;
    },
  });

  return Object.assign(
    {},
    // add plugins here
    cyDataSession(on, config)
  );
};
