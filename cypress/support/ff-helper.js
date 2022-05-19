import { datatype, name } from "@withshepherd/faker";

/** used for stateless testing in our examples */
export const randomUserId = `FF_${name
  .firstName()
  .toLowerCase()}${datatype.number()}`;

/**
 * Gets a feature flag by name
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * ```js
 * getFeatureFlag("update-order")
 * ```
 */
export const getFeatureFlag = (featureFlagKey) =>
  cy
    .log(`**getFeatureFlag** flag: ${featureFlagKey}`)
    .task("cypress-ld-control:getFeatureFlag", featureFlagKey);

/**
 * Gets all feature flags
 * @returns {Array}
 * ```js
 * getFeatureFlags()
 * ```
 */
export const getFeatureFlags = () =>
  cy.log("**getFeatureFlags**").task("cypress-ld-control:getFeatureFlags");

/**
 * Sets a feature flag variation for a user.
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * @param userId LD user id, for anonymous users it is randomly set
 * @param variationIndex index of the flag; 0 and 1 for boolean, can be more for other variants
 * ```js
 * setFlagVariation(featureFlagKey, userId, 0)
 * ```
 */
export const setFlagVariation = (featureFlagKey, userId, variationIndex) =>
  cy
    .log(
      `**setFlagVariation** flag: ${featureFlagKey} user: ${userId} variation: ${variationIndex}`
    )
    .task("cypress-ld-control:setFeatureFlagForUser", {
      featureFlagKey,
      userId,
      variationIndex,
    });

/**
 * Removes feature flag for a user.
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * @param userId LD user id, for anonymous users it is randomly set
 * ```js
 * removeUserTarget(featureFlagKey, userId)
 * ```
 */
export const removeUserTarget = (featureFlagKey, userId) =>
  cy
    .log(`**removeUserTarget** flag: ${featureFlagKey} user: ${userId}`)
    .task("cypress-ld-control:removeUserTarget", {
      featureFlagKey,
      userId,
    });

/**
 * Can be used like a deleteAll in case we have multiple users being targeted
 * @param featureFlagKey
 * @param targetIndex
 * ```js
 * removeTarget(featureFlagKey)
 * ```
 */
export const removeTarget = (featureFlagKey, targetIndex = 0) =>
  cy
    .log(`**removeTarget** flag: ${featureFlagKey} targetIndex: ${targetIndex}`)
    .task("cypress-ld-control:removeTarget", {
      featureFlagKey,
      targetIndex,
    });
