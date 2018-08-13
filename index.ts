import {HandlerInput, SkillBuilders} from 'ask-sdk';
import {Slot} from 'ask-sdk-model';

interface Slots {
  [key: string]: Slot;
}

interface SlotValue {
  synonym: string;
  resolved: string;
  isValidated: boolean;
}

interface SlotValues {
  [key: string]: SlotValue;
}

const HELP_MESSAGE =
  'You can say add $8.02 for Lyft ride, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const FALLBACK_MESSAGE =
  "The Daily Budget skill can't help you with that. It can add an expense to your daily budget Google Sheet. What can I help you with?";
const FALLBACK_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const WELCOME_OUTPUT = "Let's add an expense. How much did you spend?";
const WELCOME_REPROMPT =
  "Let me know what you bought or how much you spent.";
const EXPENSE_RECAP_SIGN_OFF = [
  'You a baller son. Keep flossing that cheddar.',
  'You gotsta pay to play homie, know-whatam-sayin.',
  'You trackin dem benjamins like the Navy Seals tracked Osama bin Laden.',
];

const LaunchRequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest';
  },
  handle(handlerInput: HandlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    return responseBuilder
      .speak(WELCOME_OUTPUT)
      .reprompt(WELCOME_REPROMPT)
      .getResponse();
  },
};

const InProgressAddExpenseHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
      request.intent.name === 'AddExpenseIntent' &&
      request.dialogState !== 'COMPLETED';
  },
  handle(handlerInput: HandlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    return handlerInput.responseBuilder
      .addDelegateDirective(currentIntent)
      .getResponse();
  },
};

const CompletedAddExpenseHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AddExpenseIntent';
  },
  handle(handlerInput: HandlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const filledSlots = handlerInput.requestEnvelope.request.intent.slots;
    const slotValues = getSlotValues(filledSlots || {});

    const speechOutput = `Okay, I’ve added ${slotValues.expenseAmount.synonym} for ${slotValues.expenseItem.synonym} to today’s expenses. Good job keeping track of your expenses! ${getRandomPhrase(EXPENSE_RECAP_SIGN_OFF)} Now I gotsa go fuck some ass. Alexa out!`;

    return responseBuilder
      .speak(speechOutput)
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
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput: HandlerInput, error: Error) {
    return handlerInput.responseBuilder
      .speak('Sorry, an error occurred.')
      .reprompt('Sorry, an error occurred.')
      .getResponse();
  },
};

function getSlotValues(filledSlots: Slots) {
  const slotValues: SlotValues = {};

  Object.keys(filledSlots).forEach((item) => {
    const name = filledSlots[item].name;

    if (filledSlots[item] != null &&
      filledSlots[item].resolutions != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0] != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code != null) {
      switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
        case 'ER_SUCCESS_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
            isValidated: true,
          };
          break;
        case 'ER_SUCCESS_NO_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].value,
            isValidated: false,
          };
          break;
        default:
          break;
      }
    } else {
      slotValues[name] = {
        synonym: filledSlots[item].value,
        resolved: filledSlots[item].value,
        isValidated: false,
      };
    }
  });

  return slotValues;
}

function getRandomPhrase(array: string[]) {
  const i = Math.floor(Math.random() * array.length);
  return (array[i]);
}

const skillBuilder = SkillBuilders.custom();

export const handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    InProgressAddExpenseHandler,
    CompletedAddExpenseHandler,
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
