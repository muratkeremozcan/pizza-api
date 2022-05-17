const ld = require("launchdarkly-node-server-sdk");
require("dotenv").config();

// we use an IIFE and wrap the module
// so that ldClient cannot be observed by any other part of the application
// This way, the handler has exclusive access to the LaunchDarkly client.
// Additionally, the instance of ldClient gets stored in the module scope
// and is reused by the handler when it is called back to back without the flag changing value

const getFlagValue = (function () {
  // ldClient holds a copy of the LaunchDarkly client that will be returned once the SDK is initialized
  let ldClient;

  /** Handles the initialization using the SDK key,
   * which is available on the account settings in the LaunchDarkly dashboard.
   * Once the client is initialized, getClient() returns it. */
  async function getClient() {
    const client = ld.init(process.env.LAUNCHDARKLY_SDK_KEY);
    await client.waitForInitialization();
    return client;
  }

  /** A generic wrapper around the client's variation() method used get a flag's current value
   * Initializes the client if it doesn't exist, else reuses the existing client.
   * Populates an anonymous user key if one is not provided for user targeting. */
  async function flagValue(key, user, defaultValue = false) {
    if (!ldClient) ldClient = await getClient();

    if (!user) {
      user = {
        key: "anonymous",
      };
    }

    // TODO: discuss this topic. It makes no difference
    // const flagValue = await ldClient.variation(key, user, defaultValue);
    // ldClient.close();

    return ldClient.variation(key, user, defaultValue);
  }

  return flagValue;
})();

module.exports = getFlagValue;
