import { FLAGS } from "../../../flag-utils/flags";

describe(`Given a feature flag that has different values in environments, such as ${FLAGS.UPDATE_ORDER}}`, () => {
  before(() => {
    cy.task("getLDFlagValue", FLAGS.UPDATE_ORDER).then((flagValue) => {
      cy.onlyOn(flagValue === true);
    });
  });

  it("The test should be enabled if the flag is enabled in that environment", () => {
    cy.log("I am running");
  });
});
