const AWS = require('aws-sdk');
require('dotenv').config();
const {
  ACCESS_KEY_ID,
  SECRET_ACCESS_KEY,
  AWS_REGION,
  SQS_QUEUE_URL,
  NOTIFICATION_FROM,
} = process.env;

AWS.config.update({
  region: AWS_REGION,
  endpoint: new AWS.Endpoint('http://localhost:4566'),
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

function smsSuccessResponse() {
  return {
    statusCode: '202',
    headers: {
      'Content-Type': 'application/json',
    },
    isBase64Encoed: false,
    body: 'message sent',
  };
}

function smsErrorResponse(err) {
  return {
    statusCode: '500',
    headers: {
      'Content-Type': 'application/json',
    },
    isBase64Encoed: false,
    body: `${err.code}` + `:` + `${err.message}`,
  };
}

function buildSqsMessage(validRequestPayload) {
  console.log('sendVerifiedMessage called');
  //     build payload
  const params = {};
  params['MessageBody'] = JSON.stringify(validRequestPayload);
  params['QueueUrl'] = SQS_QUEUE_URL;
  params['MessageDeduplicationId'] = 'DeduplicationId1';
  params['MessageGroupId'] = 'Group1';
  return params;
}

function toValidation(body) {
  console.log('toValidation called');
  var regexTo = /^((\+44)|0044|44|0)7\d{9}$/;
  if (regexTo.test(body.to)) {
    regexTo = /^447\d{9}$/;
    if (regexTo.test(body.to)) {
      body.to = '+' + body.to;
    }
  } else {
    console.log('Phone Number not accepted');
    throw new Error('Phone Number not accepted');
  }
  return body.to;
}

function placeholderValidation(body) {
  console.log('placeholderValidation called');
  const validPlaceholder = body.variableText.map((s) => s.trim());
  return validPlaceholder;
}

function fromValidation(body) {
  console.log('fromValidation called');
  if (!(NOTIFICATION_FROM === body.from)) {
    console.log(
      'From attribute not accepted from approved config/service management'
    );
    throw new Error('Request Body From attribute not accepted');
  }
  return body.from;
}

function validateMessageCreation(body) {
  console.log('validateMessageCreation called');
  body.from = fromValidation(body);
  body.variableText = placeholderValidation(body);
  body.to = toValidation(body);
  return body;
}

function verifyRequest(body) {
  console.log('verify request called');
  if (!body || !body.to || !body.contentItemId) {
    throw new Error('Invalid request body');
  }
}

exports.handler = async (event, context) => {
  // verify request
  verifyRequest(event['body-json']);

  // validate params
  const validRequestPayload = validateMessageCreation(event['body-json']);

  // call open text api
  const message = buildSqsMessage(validRequestPayload);

  // call to SQS
  console.log('call sqs service');
  const sqsResponse = await sqs
    .sendMessage(message)
    .promise()
    .then(
      function (data) {
        console.log(data);
        return smsSuccessResponse();
      },
      function (err) {
        console.log(err);
        return smsErrorResponse(err);
      }
    );
  return sqsResponse;
};
