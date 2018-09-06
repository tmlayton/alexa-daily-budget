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
  'You can say things like, "add $10 for pizza", "get today’s budget", "get today’s expenses", or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const FALLBACK_MESSAGE =
  'Sorry, I didn’t quite get that. The Daily Budget skill can add an expense to your daily expenses. What can I help you with?';
const FALLBACK_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const WELCOME_OUTPUT =
  'To get started say, add an expense, or, to know what else I can do, say, help.';
const WELCOME_REPROMPT =
  'To get started say, add an expense, or, get today’s budget.';
const DATE_COLUMN = 'A';
const INFO_COLUMNS = Object.freeze(['B', 'C', 'D']);
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
  async handle(handlerInput: HandlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const slotValues = getSlotValues(slots || {});
    const {date, dateSpeech} = dateIntent(slots.expenseDate.value);

    await addExpense(
      slotValues.expenseItem.synonym,
      slotValues.expenseAmount.synonym,
      date,
    );

    const speechOutput = `Okay, I’ve added ${
      slotValues.expenseAmount.synonym
    } for ${slotValues.expenseItem.synonym} to ${dateSpeech}’s expenses.`;

    return responseBuilder.speak(speechOutput).getResponse();
  },
};

const GetBudgetInfoHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'GetBudgetInfoIntent'
    );
  },
  async handle(handlerInput: HandlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const {date, dateSpeech} = dateIntent(slots.budgetDate.value);
    const row = (await findRowByDate(date)) + 1;
    const sheets = authorize();
    const getBudgetRowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SPREADSHEET_ID,
      range: `${INFO_COLUMNS[0]}${row}:${
        INFO_COLUMNS[INFO_COLUMNS.length - 1]
      }${row}`,
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const {haveOrHad, isOrWas} =
      dateSpeech === 'today' || date > getTodayInPST()
        ? {haveOrHad: 'have', isOrWas: 'is'}
        : {haveOrHad: 'had', isOrWas: 'was'};
    const [total, remaining, saved] = getBudgetRowResponse.data.values[0];

    const speechOutput = `${dateSpeech} you spent ${total} and ${haveOrHad} ${remaining} remaining. Your total amount saved day over day as of ${dateSpeech} ${isOrWas} ${saved}`;

    return responseBuilder.speak(speechOutput).getResponse();
  },
};

const GetExpensesHandler = {
  canHandle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'GetExpensesIntent'
    );
  },
  async handle(handlerInput: HandlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const {date, dateSpeech} = dateIntent(slots.expensesDate.value);
    const row = await findRowByDate(date);
    const sheets = authorize();
    const getExpensesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SPREADSHEET_ID,
      range: `${AVAILABLE_COLUMNS[0]}${row}:${
        AVAILABLE_COLUMNS[AVAILABLE_COLUMNS.length - 1]
      }${row + 1}`,
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'COLUMNS',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    let speechOutput;
    if (getExpensesResponse.data.values != null) {
      const expenses = getExpensesResponse.data.values
        .map((expense, index, allExpenses) => {
          const and = index === allExpenses.length - 1 ? 'and ' : '';
          return and + expense.reverse().join(' for ');
        })
        .join(', ');
      speechOutput = `${dateSpeech}’s expenses are: ${expenses}`;
    } else {
      speechOutput = `There are no expenses for ${dateSpeech}`;
    }

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
    GetBudgetInfoHandler,
    GetExpensesHandler,
    HelpHandler,
    ExitHandler,
    FallbackHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();

function authorize() {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );
  oAuth2Client.setCredentials(token);
  return google.sheets({version: 'v4', auth: oAuth2Client});
}

async function findRowByDate(date: Date) {
  const sheets = authorize();
  const getDateColumnResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${DATE_COLUMN}1:${DATE_COLUMN}999`,
    dateTimeRenderOption: 'FORMATTED_STRING',
    majorDimension: 'COLUMNS',
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const sheetDates = getDateColumnResponse.data.values[0];

  return (
    sheetDates.findIndex((dateAsString: string) => {
      const indexDate = new Date(dateAsString);
      return indexDate.toDateString() === date.toDateString();
    }) + 1
  );
}

async function addExpense(name: string, amount: string, date: Date) {
  const row = await findRowByDate(date);
  const sheets = authorize();

  // find the first empty column
  const getExpenseRowResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${AVAILABLE_COLUMNS[0]}${row}:${
      AVAILABLE_COLUMNS[AVAILABLE_COLUMNS.length - 1]
    }${row}`,
    dateTimeRenderOption: 'FORMATTED_STRING',
    majorDimension: 'ROWS',
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const column =
    getExpenseRowResponse.data.values != null
      ? AVAILABLE_COLUMNS[getExpenseRowResponse.data.values[0].length]
      : AVAILABLE_COLUMNS[0];

  // insert the expense in the empty column
  const insertExpenseResponse = await sheets.spreadsheets.values.update({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${column}${row}:${column}${row + 1}`,
    includeValuesInResponse: true,
    responseDateTimeRenderOption: 'FORMATTED_STRING',
    responseValueRenderOption: 'FORMATTED_VALUE',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[name], [amount]],
    },
  });
  console.log(insertExpenseResponse.data);
}

function ordinalSuffixFor(i: number) {
  const j = i % 10;
  const k = i % 100;

  if (j == 1 && k != 11) {
    return i + 'st';
  }
  if (j == 2 && k != 12) {
    return i + 'nd';
  }
  if (j == 3 && k != 13) {
    return i + 'rd';
  }
  return i + 'th';
}

function dateIntent(dateString: string | null) {
  let date;
  let dateSpeech;

  if (dateString != null) {
    date = new Date(dateString);
    dateSpeech =
      date.toDateString() !== getTodayInPST().toDateString()
        ? `${date.toLocaleDateString('en-US', {
            month: 'long',
          })} ${ordinalSuffixFor(date.getDate())}`
        : 'today';
  } else {
    date = getTodayInPST();
    dateSpeech = 'today';
  }

  return {date, dateSpeech};
}

function getTodayInPST() {
  return new Date(new Date().getTime() + -7 * 3600 * 1000);
}
