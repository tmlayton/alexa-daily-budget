import {HandlerInput, SkillBuilders} from 'ask-sdk';

const ALEXA_SKILL_NAME = 'Daily Budget';
const GET_FACT_MESSAGE = "Here's your fact: ";
const HELP_MESSAGE =
  'You can say tell me a space fact, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const FALLBACK_MESSAGE =
  "The Space Facts skill can't help you with that.  It can help you discover facts about space if you say tell me a space fact. What can I help you with?";
const FALLBACK_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';

const data = [
  "Sometimes I feel like a nut, sometimes I don't. Almond Joy has nuts, Mounds don't.",
];

const GetNewFactHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === 'LaunchRequest' ||
      (request.type === 'IntentRequest' &&
        request.intent.name === 'GetNewFactIntent')
    );
  },
  handle(handlerInput: HandlerInput) {
    const randomFact = data[Math.floor(Math.random() * data.length)];
    const speechOutput = GET_FACT_MESSAGE + randomFact;

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .withSimpleCard(ALEXA_SKILL_NAME, randomFact)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};

const FallbackHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'AMAZON.FallbackIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder
      .speak(FALLBACK_MESSAGE)
      .reprompt(FALLBACK_REPROMPT)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === 'IntentRequest' &&
      (request.intent.name === 'AMAZON.CancelIntent' ||
        request.intent.name === 'AMAZON.StopIntent')
    );
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder.speak(STOP_MESSAGE).getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput: HandlerInput) {
    console.log(
      `Session ended. Request dump: ${handlerInput.requestEnvelope.request}`,
    );

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput: HandlerInput, error: Error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, an error occurred.')
      .reprompt('Sorry, an error occurred.')
      .getResponse();
  },
};

const skillBuilder = SkillBuilders.custom();

export const handler = skillBuilder
  .addRequestHandlers(
    GetNewFactHandler,
    HelpHandler,
    ExitHandler,
    FallbackHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();

// import {google} from 'googleapis';
//  import config from './config.json';
//  console.log(config.GOOGLE_API_KEY);
// const availableColumns = ['B', 'C', 'D', 'E', 'F', 'F', 'G'];
// const sheets = google.sheets({version: 'v4', auth: config.GOOGLE_API_KEY})

// function addExpense(name, amount, date) {
//   const row = getRowByDate(date);
//   const column = findNextAvailableColumn(row);
//   setCellValue(column, row, name);
//   setCellValue(column, row + 1, amount);
// }

// function getRowByDate(date) {
//   return 1;
// }

// function findNextAvailableColumn(row) {
//   return availableColumns.find((column) => {
//     const cellValue = getCellValue(column, row);
//     return cellValue == null || cellValue === '';
//   });
// }

// function getCellValue(column, row): string {
//   // Google sheets API read here
//   return 'hi';
// }

// function setCellValue(column, row, value) {
//   // Google sheets API write here
// }

// function authorize() {
//   const request = {
//     spreadsheetId: '1CDxht0aHcwMmfeohCZxvamwO9MJJqTCwhF_bWnimHFw',
//     range: 'A1:A9999',
//     dateTimeRenderOption: 'FORMATTED_STRING',
//     majorDimension: 'COLUMNS',
//     valueRenderOption: 'FORMATTED_VALUE',
//   };

//   sheets.spreadsheets.values.get(request, (err, response) => {
//     if (err) {
//       console.error(err);
//       return;
//     }

//     // TODO: Change code below to process the `response` object:
//     console.log(JSON.stringify(response, null, 2));
//   });
// }
