const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const docClient = new AWS.DynamoDB.DocumentClient();
const getLDFlagValue = require("../flag-utils/get-ld-flag-value");
const { FLAGS } = require("../flag-utils/flags");

async function updateOrder(orderId, options) {
  const FF_UPDATE_ORDER = await getLDFlagValue(FLAGS.UPDATE_ORDER);

  console.log("You tried to Update the order: ", orderId);
  console.log("The flag value is: ", FF_UPDATE_ORDER);

  if (!options || !options.pizza || !options.address) {
    throw new Error("Both pizza and address are required to update an order");
  }

  if (FF_UPDATE_ORDER) {
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
  } else {
    console.log("Update order feature is disabled");
    return {
      orderId: orderId,
      pizza: options.pizza,
      address: options.address,
    };
  }
}

module.exports = updateOrder;
