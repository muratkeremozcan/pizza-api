const ld = require("launchdarkly-node-server-sdk");
require("dotenv").config();

// we use an IIFE and wrap the module
// so that ldClient cannot be observed by any other part of the application
// This way, the handler has exclusive access to the LaunchDarkly client.

/**
 * 1. Initializes the LD client & waits for the initialization to complete.
 * 2. Gets the flag value using the LD client.
 * 3. If a user is not provided while getting the flag value, populates an anonymous user generic users.
 * 4. The code calling the LD client cannot be observed by any other part of the application.
 */
const getLDFlagValue = (function () {
  /** Handles the initialization using the SDK key,
   * which is available on the account settings in the LaunchDarkly dashboard.
   * Once the client is initialized, getClient() returns it. */
  async function getClient() {
    const client = ld.init(process.env.LAUNCHDARKLY_SDK_KEY);
    await client.waitForInitialization();
    return client;
  }

  /** A generic wrapper around the client's variation() method used get a flag's current value
   * Initializes the client
   * Populates an anonymous user key if one is not provided, to handle generic users. */
  async function flagValue(key, user, defaultValue = false) {
    // We want a unique LD client instance with every call to ensure stateless assertions
    const ldClient = await getClient();

    if (!user) {
      user = {
        key: "anonymous",
      };
    }

    const flagValue = await ldClient.variation(key, user, defaultValue);
    console.log(
      `**LDclient** flag: ${key} user.key: ${user.key} value: ${flagValue}`
    );
    return flagValue;
  }

  return flagValue;
})();

module.exports = getLDFlagValue;
