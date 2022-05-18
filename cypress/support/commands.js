import { datatype, address } from "@withshepherd/faker";

const headers = (token) => ({
  "Access-Token": token,
});

Cypress.Commands.add(
  "createOrder",
  (
    token,
    body = {
      pizza: datatype.number(),
      address: address.streetAddress(),
    },
    allowedToFail = false
  ) =>
    cy.log("**createOrder**").api({
      method: "POST",
      url: `/orders`,
      headers: headers(token),
      body,
      retryOnStatusCodeFailure: !allowedToFail,
      failOnStatusCode: !allowedToFail,
    })
);

Cypress.Commands.add("getOrders", (token, allowedToFail = false) =>
  cy.log("**getOrders**").api({
    method: "GET",
    url: `/orders`,
    headers: headers(token),
    retryOnStatusCodeFailure: !allowedToFail,
    failOnStatusCode: !allowedToFail,
  })
);

Cypress.Commands.add("getOrder", (token, orderId, allowedToFail = false) =>
  cy.log("**getOrder**").api({
    method: "GET",
    url: `/orders/${orderId}`,
    headers: headers(token),
    retryOnStatusCodeFailure: !allowedToFail,
    failOnStatusCode: !allowedToFail,
  })
);

Cypress.Commands.add(
  "updateOrder",
  (
    token,
    orderId,
    body = {
      pizza: datatype.number(),
      address: address.streetAddress(),
    },
    allowedToFail = false
  ) =>
    cy.log("**updateOrder**").api({
      method: "PUT",
      url: `/orders/${orderId}`,
      headers: headers(token),
      body,
      retryOnStatusCodeFailure: !allowedToFail,
      failOnStatusCode: !allowedToFail,
    })
);

Cypress.Commands.add("deleteOrder", (token, orderId, allowedToFail = false) =>
  cy.log("**deleteOrder**").api({
    method: "DELETE",
    url: `/orders/${orderId}`,
    headers: headers(token),
    retryOnStatusCodeFailure: !allowedToFail,
    failOnStatusCode: !allowedToFail,
  })
);

/** Checks if a pizza with the given id exists in the database */
const checkPizza = (token, pizzaId) =>
  cy
    .getOrders(token, true) // allowed to fail
    .its("body")
    .then(
      (orders) =>
        Cypress._.filter(orders, (order) => order.pizza === pizzaId).length
    )
    .then(Boolean);

Cypress.Commands.add(
  "maybeCreateOrder",
  (
    sessionName,
    token,
    body = {
      pizza: datatype.number(),
      address: address.streetAddress(),
    }
  ) =>
    cy.dataSession({
      name: `${sessionName}`,

      // this is not really necessary, it is here for clarity and educational purposes
      init: () => {
        cy.log(
          `**init()**: runs when there is nothing in cache. Yields the value to validate()`
        );
      },

      validate: () => {
        cy.log(
          `**validate()**: returns true if the pizza already exists, false otherwise.`
        );
        return checkPizza(token, body.pizza);
      },

      setup: () => {
        cy.log(
          `**setup()**: there is no pizza by that id, so create an order.`
        );
        cy.createOrder(token, body);
      },

      recreate: () => {
        cy.log(
          `**recreate()**: if there is a pizza by that ID, just resolve a promise through`
        );
        Promise.resolve();
      },

      onInvalidated: () => {
        cy.log(
          `**onInvalidated**: runs when validate() returns false; no pizza!`
        );
      },

      shareAcrossSpecs: true,
    })
);
