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
    const TRUE_VARIANT = 0; // generic users get this
    const FALSE_VARIANT = 1; // targeted users get this

    afterEach("user-targeted-flag clean up", () =>
      removeUserTarget(FLAGS.UPDATE_ORDER, randomUserId)
    );

    it("should get the flag value for generic users using Cypress test plugin", () => {
      getFeatureFlag(FLAGS.UPDATE_ORDER)
        .its("environments.test.fallthrough.variation")
        .should("eq", TRUE_VARIANT);
    });

    it("should get the flag value for generic users using the LD instance", () => {
      cy.task("getLDFlagValue", FLAGS.UPDATE_ORDER).should("eq", true);
    });

    it("should get the flag value TRUE using the LD instance", () => {
      setFlagVariation(FLAGS.UPDATE_ORDER, randomUserId, TRUE_VARIANT);

      cy.task("getLDFlagValue", {
        key: FLAGS.UPDATE_ORDER,
        userId: randomUserId,
      }).should("eq", true);
    });

    it("should get the flag value FALSE using the LD instance", () => {
      setFlagVariation(FLAGS.UPDATE_ORDER, randomUserId, FALSE_VARIANT);

      cy.task("getLDFlagValue", {
        key: FLAGS.UPDATE_ORDER,
        userId: randomUserId,
      }).should("eq", false);
    });
  });
});
