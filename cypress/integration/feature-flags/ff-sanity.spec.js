import {
  getFeatureFlags,
  getFeatureFlag,
  setFlagVariation,
  removeUserTarget,
  randomUserId,
} from "../../support/ff-helper";
import spok from "cy-spok";
import { FLAGS } from "../../../flag-utils/flags";

describe("FF sanity", () => {
  it("should get flags", () => {
    getFeatureFlag(FLAGS.UPDATE_ORDER).its("key").should("eq", "update-order");

    getFeatureFlags().its("items.0.key").should("eq", "update-order");
  });

  it("should get flag variations", () => {
    getFeatureFlag(FLAGS.UPDATE_ORDER)
      .its("variations")
      .should((variations) => {
        expect(variations[0].value).to.eq(true);
        expect(variations[1].value).to.eq(false);
      });
  });

  it("should get flag variations and do deeper assertions with spok", () => {
    getFeatureFlag(FLAGS.UPDATE_ORDER)
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
  });

  context("flag toggle using the test plugin", () => {
    const DEFAULT_RULE_TRUE = 0; // generic users get this
    const TARGETED_RULE_FALSE = 1; // targeted users get this

    beforeEach("set flag variation for a targeted user", () =>
      setFlagVariation(FLAGS.UPDATE_ORDER, randomUserId, TARGETED_RULE_FALSE)
    );
    afterEach("user-targeted-flag clean up", () =>
      removeUserTarget(FLAGS.UPDATE_ORDER, randomUserId)
    );

    it("should get the flag value for generic users using Cypress test plugin", () => {
      getFeatureFlag(FLAGS.UPDATE_ORDER)
        .its("environments.test.fallthrough.variation")
        .should("eq", DEFAULT_RULE_TRUE);
    });

    it("should get the flag value for generic users vs the targeted user using the LD instance", () => {
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
