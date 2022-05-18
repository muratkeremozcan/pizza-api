/**
 * Gets a feature flag by name
 * @param featureFlagKey this is usually a kebab-case string, or an enum representation of it
 * ```js
 * getFeatureFlag("update-order")
 * ```
 */
export const getFeatureFlag = (featureFlagKey) =>
  cy.task("cypress-ld-control:getFeatureFlag", featureFlagKey);

/**
 * Gets all feature flags
 * @returns {Array}
 * ```js
 * getFeatureFlags()
 * ```
 */
export const getFeatureFlags = () =>
  cy.task("cypress-ld-control:getFeatureFlags");

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
  cy.task("cypress-ld-control:setFeatureFlagForUser", {
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
  cy.task("cypress-ld-control:removeUserTarget", {
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
  cy.task("cypress-ld-control:removeTarget", {
    featureFlagKey,
    targetIndex,
  });
