var fs = require('fs');
var path = require('path');
var exec = require('child_process').execSync;
var _ = require('lodash');
var Progress = require('progress');
var PouchDB = require('pouchdb');
var rimraf = require('rimraf');
var config = require('./config');

var users = [];
var answerCounts = {};
var bulkWriteSize = 250;

var questions = new PouchDB(config.questionDbPath);
rimraf.sync(path.resolve(config.answerDbPath));
var answers = new PouchDB(config.answerDbPath);
var tasks = [];

var binaryCSV = require('binary-csv');
var usersParser = binaryCSV({
  separator: ',',
  json: true
});

// helper to fetch question by id (memoized for speed)
var getQuestion = _.memoize(function (id) {
  return questions.get(id)
  .catch(function (err) {
    err.status
    if (err.status !== 404) throw err;
  });
});

// helper to fetch answer index (memoized for speed)
var getAnswerIndex = _.memoize(function (doc, answer) {
  var match = answer.toLowerCase();
  if (match === doc.option_1.toLowerCase()) return 'option_1_count';
  if (match === doc.option_2.toLowerCase()) return 'option_2_count';
  if (match === doc.option_3.toLowerCase()) return 'option_3_count';
  if (match === doc.option_4.toLowerCase()) return 'option_4_count';
}, function (doc, answer) {
  return doc._id + answer;
});

var tallyAnswer = function (doc, answer) {
  if (!doc) return;
  if (answer.length === 0) return;

  var index = getAnswerIndex(doc, answer);

  if (index) {
    var oldVal = _.get(answerCounts, [doc._id, index], 0);
    _.set(answerCounts, [doc._id, index], oldVal + 1);
  }
}

// stream user data, write to answers file
var userDataFile = path.resolve('data', 'user_data.csv');
var lineCount = parseInt(exec('wc -l ' + userDataFile).toString().split(' ')[3]);

var bar = new Progress(' Processing [:bar] :current/:total (:percent) :etas', {
  width: 80,
  total: lineCount
});

var count = 0;
var chain = Promise.resolve();

fs.createReadStream(userDataFile)
.pipe(usersParser)
.on('data', function (line) {
  var mapped = {};
  var userId = count++;

  chain = chain.then(function () {
    var cols = Object.keys(line);

    var tasks = cols.map(function (qid) {
      var answer = line[qid];

      return getQuestion(qid)
      .then(function (question) {
        if (question) {
          mapped[qid] = { q: question.text, a: answer };
          return tallyAnswer(question, answer);
        }
        mapped[qid] = answer;
      });
    });

    return Promise.all(tasks)
    .then(function () {
      users.push(Object.assign({ _id: 'u' + leftPad(4, userId) }, line));

      if (users.length === bulkWriteSize) {
        return answers.bulkDocs(users)
        .then(function () {
          users = [];
          bar.tick();
        })
      }

      bar.tick();
    })
    .catch(function (err) {
      console.log(err);
      bar.tick();
    })
  });
})
.on('end', function () {
  chain
  .then(function () {
    if (users.length) return answers.bulkDocs(users);
  })
  .then(function () { console.log('Successfully saved user data', lineCount) })
  .then(updateQuestions);
});

function updateQuestions() {
  var questionIds = Object.keys(answerCounts);
  var questionCount = questionIds.length;
  console.log('Updating question counts (%d total)...', questionCount);

  var tasks = questionIds.map(function (questionId) {
    return questions.get(questionId)
    .then(function (doc) {
      return Object.assign(doc, answerCounts[questionId]);
    })
  });

  return Promise.all(tasks)
  .then(function (docs) {
    return questions.bulkDocs(docs);
  })
  .then(function () {
    console.log('Successfully updated %d questions', questionIds.length);
  })
  .catch(function (err) {
    console.log('ERROR');
    console.log(err);
  })
}

function leftPad(t,v){
  v+="";return v.length>=t?v:leftPad(t,'0'+v);
}
