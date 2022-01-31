const AWS = require('aws-sdk');
require('dotenv').config();
const {
  ACCESS_KEY_ID,
  SECRET_ACCESS_KEY,
  AWS_REGION,
  SQS_QUEUE_URL,
} = process.env;

AWS.config.update({
  region: AWS_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

function smsSuccessResponse() {
  return {
    statusCode: '200',
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

function openTextExstreamRequestBuilder(payload) {
  console.log('sendVerifiedMessage called');
  const body = JSON.parse(payload);
  const openTextExtreamPayload = {};
  openTextExtreamPayload['customers'] = [];
  const customer = {};
  const variableText = body['variableText'];
  const channels = body['channels'];
  customer['contentDetails'] = {
    locale: body['locale'],
    contentItemId: body['contentItemId'],
    variableText,
  };
  customer['communicationDetails'] = {
    to: body['to'],
    from: body['from'],
    channels,
  };

  const params = {};
  params['MessageBody'] = JSON.stringify(openTextExtreamPayload);
  params['QueueUrl'] = SQS_QUEUE_URL;
  params['MessageDeduplicationId'] = 'DeduplicationId1';
  params['MessageGroupId'] = 'Group1';
  return params;
}

exports.handler = async (event, context) => {
  // recieve sqs message
  console.log('sqs transformation service called');
  let body;
  event.Records.forEach((record) => {
    body = record.body;
  });

  //transform payload
  const openTextExtreamPayload = openTextExstreamRequestBuilder(body);

  // call to SQS
  /** need to change url to 24/7 sqs queue in .env for local and
   *  Environment variables for lambda deployment */
  console.log('call sqs service');
  const sqsResponse = await sqs
    .sendMessage(openTextExtreamPayload)
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
  console.log('sqsResponse: ' + JSON.stringify(sqsResponse));

  return sqsResponse;
};
