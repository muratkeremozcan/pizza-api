const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const docClient = new AWS.DynamoDB.DocumentClient();
const ld = require("launchdarkly-node-server-sdk");
require("dotenv").config();

const ldClient = ld.init(process.env.LAUNCHDARKLY_SDK_KEY);

const ldClientStatus = async () => {
  let response = {
    statusCode: 200,
  };
  try {
    await ldClient.waitForInitialization();
    response.body = JSON.stringify("Initialization successful");
  } catch (err) {
    response.body = JSON.stringify("Initialization failed");
  }
  return response;
};

function getOrders(orderId) {
  console.log("Get order(s)", orderId);

  console.log("INVOKING LAUNCHDARKLY TEST");
  ldClientStatus().then(console.log);

  if (typeof orderId === "undefined") {
    return docClient
      .scan({
        TableName: "pizza-orders",
      })
      .promise()
      .then((result) => result.Items);
  }

  return docClient
    .get({
      TableName: "pizza-orders",
      Key: {
        // the get method requires a primary key, in this case orderId
        orderId: orderId,
      },
    })
    .promise()
    .then((result) => result.Item);
}

module.exports = getOrders;
