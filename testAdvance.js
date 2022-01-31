const logger = require('./logger').createLogger('sms_notify_top_lambda_sqs');
const AWS = require('aws-sdk');

let sqs = null;
let aws_options = null;

let url_cache = {};

function sqs_configure() {
    if ( !sqs ) {
        aws_options = { endpoint : process.env.AWS_SQS_ENDPOINT};
        sqs = new AWS.SQS(aws_options);
    }
}

async function url_for_queue(qName) {

    if (url_cache.hasOwnProperty(qName)) {
        return url_cache[qName];
    }

    sqs_configure();

    await sqs.getQueueUrl({ 'QueueName': qName }).promise()
        .then(function (data) {
            url_cache[qName] = data.QueueUrl;
        }).catch(function (err) {
            throw (err);
        });

    return url_cache[qName];
}

async function url_for_arn(arn) {
    sqs_configure();
    const elements = arn.split(':');
    return url_for_queue(elements[5]);
}

// Enqueue to downstream (FIFO Queue)
async function enq_fifo(payload, attributes, group_id, q_url) {
    sqs_configure();

    var params = {
        MessageAttributes: attributes,
        MessageBody: payload,
        MessageGroupId: group_id,
        QueueUrl: q_url
    };

    logger.debug('downstream queue data: ', JSON.stringify(params));
    const sqsResponse = await sqs.sendMessage(params).promise();
    return sqsResponse.MessageId;
}


async function delete_message(q_url, handle) {
    sqs_configure();
    let data = await sqs.deleteMessage({ QueueUrl: q_url, ReceiptHandle: handle }).promise();
    return data.ResponseMetadata.RequestId;
}

module.exports = {
    url_for_queue,
    url_for_arn,
    delete_message,
    enq_fifo
}
