import { getFeatureFlags, getFeatureFlag } from "../support/ff-helper";
import spok from "cy-spok";
import { FLAGS } from "../../flag-utils/flags";

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

  it("should do deeper assertions with spok", () => {
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
});
