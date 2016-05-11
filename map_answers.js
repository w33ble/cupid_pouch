var fs = require('fs');
var path = require('path');
var exec = require('child_process').execSync;

var _ = require('lodash');
var Progress = require('progress');

var low = require('lowdb');
var storage = require('lowdb/file-sync');
var db = low(path.resolve('output', 'questions.json'), { storage }, false);

var binaryCSV = require('binary-csv');
var usersParser = binaryCSV({
  separator: ',',
  json: true
});

// create target file
var wstream = fs.createWriteStream(path.resolve('output', 'answers.json');
wstream.write('{ "users": [\n');

// create a quick question lookup object
var questionLookup = {};
db('questions').each(function (q) {
  questionLookup[q.id] = q;
});

// helper to pull question from the lookup, by id
var getQuestion = _.memoize(function (id) {
  var q = _.get(questionLookup, id, id);
  return q;
});

var tallyAnswer = function (q, answer) {
  if (!q.id) return;
  if (answer.length === 0) return;

  db('questions')
  .chain()
  .find({ id: q.id })
  .thru(function (q) {
    var a = answer.toLowerCase();

    switch (a) {
      case q.option_1.toLowerCase():
        // console.log('option_1_count');
        q.option_1_count += 1;
        break;
      case q.option_2.toLowerCase():
        // console.log('option_2_count');
        q.option_2_count += 1;
        break;
      case q.option_3.toLowerCase():
        // console.log('option_3_count');
        q.option_3_count += 1;
        break;
      case q.option_4.toLowerCase():
        // console.log('option_4_count');
        q.option_4_count += 1;
        break;
    }

    return q;
  })
  .value();
}

// stream user data, write to answers file
var counter = 0;
var userDataFile = path.resolve('data', 'user_data.csv');
var lineCount = parseInt(exec('wc -l ' + userDataFile).toString().split(' ')[3]);

console.log('%d answers to parse...', lineCount);
var bar = new Progress(' Processing [:bar] :current/:total (:percent) :etas', {
  width: 80,
  total: lineCount
});

fs.createReadStream(userDataFile)
.pipe(usersParser)
.on('data', function (line) {
  var mapped = {};
  Object.keys(line).map(function (qid) {
    var q = getQuestion(qid);
    var a = line[qid];
    mapped[qid] = (!q.text) ? a : { q: q.text, a: a };
    tallyAnswer(q, a);
  });

  if (counter++ % 200 === 0) {
    db.write();
  }
  bar.tick();
  wstream.write(JSON.stringify(mapped));
})
.on('end', function () {
  wstream.write('\n] }');
  wstream.end();
  db.write();
  console.log('DONE!  ', counter, 'users stored');
});
