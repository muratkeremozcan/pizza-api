const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const docClient = new AWS.DynamoDB.DocumentClient();

const ld = require("launchdarkly-node-server-sdk");

let ldClient;

async function getClient() {
  const client = ld.init("sdk-cfcea545-e9ad-437b-8aa0-090f501687f8");
  await client.waitForInitialization();
  return client;
}

async function getFlagValue(key, user, defaultValue = false) {
  if (!ldClient) ldClient = await getClient();

  if (!user) {
    user = {
      key: "anonymous",
    };
  }

  return ldClient.variation(key, user, defaultValue);
}

function updateOrder(orderId, options) {
  console.log("Update an order", orderId);

  getFlagValue("update-order").then((flagValue) => {
    console.log("FEATURE FLAG VALUE IS:", flagValue);
  });

  if (!options || !options.pizza || !options.address) {
    throw new Error("Both pizza and address are required to update an order");
  }

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
