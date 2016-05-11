var fs = require('fs');
var path = require('path');
var questionsFile = path.resolve('output', 'questions.json');

var low = require('lowdb');
var storage = require('lowdb/file-sync');
fs.unlinkSync(questionsFile);
var db = low(questionsFile, { storage }, false);

var binaryCSV = require('binary-csv');
var questionParser = binaryCSV({
  separator: ';',
  json: true
});
var testParser = binaryCSV({
  separator: ',',
  json: true
});

fs.createReadStream(path.join(__dirname, 'data', 'question_data.csv'))
.pipe(questionParser)
.on('data', function (line) {
  if (line.id.match(/^q[1-9]/)) {
    Object.assign(line, {
      option_1_count: 0,
      option_2_count: 0,
      option_3_count: 0,
      option_4_count: 0,
    })
    db('questions').push(line);
  }
})
.on('end', function () {
  console.log('Questions DONE');

  fs.createReadStream(path.join(__dirname, 'data', 'test_items.csv'))
  .pipe(testParser)
  .on('data', function (line) {
    if (line.id.match(/^q[1-9]/)) {
      db('questions')
      .chain()
      .find({ id: line.id })
      .thru(function (q) {
        if (!q) return;
        q.option_correct = line.option_correct;
        q.Keywords += '; test';
        return q;
      })
      .value();
    }
  })
  .on('end', function () {
    console.log('Tests DONE');
    console.log('writing questions file');
    db.write();
    console.log('Questions Compiled', questionsFile);
  })
})
