const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const docClient = new AWS.DynamoDB.DocumentClient();
// (1) update and initialize LaunchDarkly client
const ld = require("launchdarkly-node-server-sdk");
const ldClient = ld.init("sdk-cfcea545-e9ad-437b-8aa0-090f501687f8");

const getFlagValue = async () => {
  let response = {
    statusCode: 200,
  };
  let FF_UPDATE_ORDER;

  try {
    await ldClient.waitForInitialization();
    FF_UPDATE_ORDER = await ldClient.variation(
      "update-order",
      { anonymous: true },
      false
    );
    response.body = JSON.stringify("Initialization successful");
  } catch (err) {
    response.body = JSON.stringify("Initialization failed");
  }

  return FF_UPDATE_ORDER;
};

// // (2) wait for the initialization

function updateOrder(orderId, options) {
  console.log("Update an order", orderId);

  getFlagValue().then((flagValue) => {
    console.log("Flag value is :", flagValue);
  });

  if (!options || !options.pizza || !options.address) {
    throw new Error("Both pizza and address are required to update an order");
  }

  // (3) get the flag value

  // console.log("Flag value is :", FF_UPDATE_ORDER);

  // if (!FF_UPDATE_ORDER)
  //   throw new Error("update-order feature flag is not enabled");

  return docClient
    .update({
      TableName: "pizza-orders",
      Key: {
        orderId: orderId,
      },
      UpdateExpression: "set pizza = :p, address = :a", // Describe how the update will modify attributes of an order
      ExpressionAttributeValues: {
        // Provide the values to the UpdateExpression expression
        ":p": options.pizza,
        ":a": options.address,
      },
      ReturnValues: "ALL_NEW", // Tell DynamoDB that you want a whole new item to be returned
    })
    .promise()
    .then((result) => {
      console.log("Order is updated!", result);
      return result.Attributes;
    })
    .catch((updateError) => {
      console.log(`Oops, order is not updated :(`, updateError);
      throw updateError;
    });
}

module.exports = updateOrder;
