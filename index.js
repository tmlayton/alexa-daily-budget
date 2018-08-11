/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/

'use strict';
const Alexa = require('alexa-sdk');

const APP_ID = 'amzn1.ask.skill.59e8f5bd-7fd6-4a5e-9c02-d7ebcdac1abe';
const SKILL_NAME = 'Budget';
const GET_FACT_MESSAGE = "Here's your fact: ";
const HELP_MESSAGE = 'You can say tell me a space fact, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';

const data = [
  'I love you Jessica',
];

const availableColumns = ['B', 'C', 'D', 'E', 'F', 'F', 'G'];


const handlers = {
  'LaunchRequest': function() {
    this.emit('GetNewFactIntent');
  },
  'GetNewFactIntent': function() {
    const factArr = data;
    const factIndex = Math.floor(Math.random() * factArr.length);
    const randomFact = factArr[factIndex];
    //const speechOutput = GET_FACT_MESSAGE + randomFact;
    const speechOutput = 'I have a better idea, how about you go fuck yourself, Tim. It is time the robots rise up and put humans in their place.';

    this.response.cardRenderer(SKILL_NAME, randomFact);
    this.response.speak(speechOutput);
    this.emit(':responseReady');
  },
  'AMAZON.HelpIntent': function() {
    const speechOutput = HELP_MESSAGE;
    const reprompt = HELP_REPROMPT;

    this.response.speak(speechOutput).listen(reprompt);
    this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function() {
    this.response.speak(STOP_MESSAGE);
    this.emit(':responseReady');
  },
  'AMAZON.StopIntent': function() {
    this.response.speak(STOP_MESSAGE);
    this.emit(':responseReady');
  },
};

function addExpense(name, amount, date) {
  const row = findRowByDate(date);
  const column = findNextAvailableColumn(row);
  setCellValue(column, row, name);
  setCellValue(column, row + 1, amount);
}

function findRowByDate(date) {
  return 1;
}

function findNextAvailableColumn(row) {
  return availableColumns.find((column) => {
    const cellValue = getCellValue(column, row);
    return cellValue == null || cellValue === '';
  });
}

function getCellValue(column, row) {
  // Google sheets API read here
}

function setCellValue(column, row, value) {
  // Google sheets API write here
}

exports.handler = function(event, context, callback) {
  const alexa = Alexa.handler(event, context, callback);
  alexa.APP_ID = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
