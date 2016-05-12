var fs = require('fs');
var path = require('path');
var exec = require('child_process').execSync;
var _ = require('lodash');
var Progress = require('progress');
var PouchDB = require('pouchdb');
var config = require('./config');

var questions = new PouchDB(config.questionDbPath);
var tasks = [];

var binaryCSV = require('binary-csv');
var usersParser = binaryCSV({
  separator: ',',
  json: true
});

// create target file
var wstream = fs.createWriteStream(path.resolve('output', 'answers.json'));
wstream.write('{ "users": [\n');

// helper to pull question from the lookup, by id
var getQuestion = _.memoize(function (id) {
  return questions.get(id)
  .catch(function (err) {
    err.status
    if (err.status !== 404) throw err;
  });
});

var answerCounts = {};
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

  chain = chain.then(function () {
    var cols = Object.keys(line);

    var tasks = cols.map(function (qid) {
      var a = line[qid];
      // console.log(qid, i, cols.length);

      return getQuestion(qid)
      .then(function (question) {
        if (question) {
          // console.log(question._id, i);
          mapped[qid] = { q: question.text, a: a };
          return tallyAnswer(question, a);
        }
        mapped[qid] = a;
      });
    });

    return Promise.all(tasks)
    .then(function () {
      bar.tick();
      wstream.write(JSON.stringify(mapped));
    });
  });
})
.on('end', function () {
  wstream.write('\n] }');
  wstream.end();
  chain
  .then(function () { console.log('Successfully saved user data', lineCount) })
  .then(updateQuestions);
});

function updateQuestions() {
  var questionIds = Object.keys(answerCounts);
  var questionCount = questionIds.length;
  console.log('Updating questions counts (%d total)...', questionCount);

  var bar = new Progress(' Processing [:bar] :current/:total (:percent) :etas', {
    width: 80,
    total: questionCount
  });

  var tasks = questionIds.map(function (questionId) {
    return questions.get(questionId)
    .then(function (doc) {
      Object.assign(doc, answerCounts[questionId]);
      return questions.put(doc)
      .then(function () {
        bar.tick();
      });
    })
  });

  return Promise.all(tasks)
  .then(function () {
    console.log('Successfully update %d questions', questionIds.length);
  })
}