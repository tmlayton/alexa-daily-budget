import {HandlerInput, SkillBuilders} from 'ask-sdk';
import {Slot} from 'ask-sdk-model';
import {google} from 'googleapis';
import config from './config.json';
import credentials from './credentials.json';
import token from './token.json';

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
const WELCOME_OUTPUT =
  'To get started say, add an expense. Or you can say, add $8 for Lyft.';
const WELCOME_REPROMPT = 'To get started say, add an expense.';
const DATE_COLUMN = 'A';
const AVAILABLE_COLUMNS = Object.freeze([
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
]);

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
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'AddExpenseIntent' &&
      request.dialogState !== 'COMPLETED'
    );
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
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'AddExpenseIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const filledSlots = handlerInput.requestEnvelope.request.intent.slots;
    const slotValues = getSlotValues(filledSlots || {});

    const offset = -7;
    const todayInPDT = new Date(new Date().getTime() + offset * 3600 * 1000);

    addExpense(
      slotValues.expenseItem.synonym,
      slotValues.expenseAmount.synonym,
      todayInPDT,
    );

    const speechOutput = `Okay, I’ve added ${
      slotValues.expenseAmount.synonym
    } for ${slotValues.expenseItem.synonym} to today’s expenses. Good job boo!`;

    return responseBuilder.speak(speechOutput).getResponse();
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

    if (
      filledSlots[item] != null &&
      filledSlots[item].resolutions != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0] != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status != null &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code !=
        null
    ) {
      switch (
        filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code
      ) {
        case 'ER_SUCCESS_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved:
              filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0]
                .value.name,
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

function addExpense(name: string, amount: string, date: Date) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );
  oAuth2Client.setCredentials(token);
  const sheets = google.sheets({version: 'v4', auth: oAuth2Client});

  const request1 = {
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${DATE_COLUMN}1:${DATE_COLUMN}999`,
    dateTimeRenderOption: 'FORMATTED_STRING',
    majorDimension: 'COLUMNS',
    valueRenderOption: 'FORMATTED_VALUE',
  };

  sheets.spreadsheets.values.get(request1, (err: any, response: any) => {
    if (err) {
      console.error(err);
      return;
    }

    const sheetDates = response.data.values[0];
    const row =
      sheetDates.findIndex((dateAsString: string) => {
        const indexDate = new Date(dateAsString);
        return indexDate.toDateString() === date.toDateString();
      }) + 1;

    const request2 = {
      spreadsheetId: config.SPREADSHEET_ID,
      range: `${AVAILABLE_COLUMNS[0]}${row}:${
        AVAILABLE_COLUMNS[AVAILABLE_COLUMNS.length - 1]
      }${row}`,
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMATTED_VALUE',
    };

    sheets.spreadsheets.values.get(request2, (err: any, response: any) => {
      if (err) {
        console.error(err);
        return;
      }

      let column;
      if (response.data.values != null) {
        column = AVAILABLE_COLUMNS[response.data.values[0].length];
      } else {
        column = AVAILABLE_COLUMNS[0];
      }

      const request3 = {
        spreadsheetId: config.SPREADSHEET_ID,
        range: `${column}${row}:${column}${row + 1}`,
        includeValuesInResponse: true,
        responseDateTimeRenderOption: 'FORMATTED_STRING',
        responseValueRenderOption: 'FORMATTED_VALUE',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[name], [amount]],
        },
      };

      sheets.spreadsheets.values.update(request3, function(
        err: any,
        response: any,
      ) {
        if (err) {
          console.error(err);
          return;
        }

        console.log(response.data);
      });
    });
  });
}
