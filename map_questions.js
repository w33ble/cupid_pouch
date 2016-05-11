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
    var mapped = {
      id: line.id,
      text: line.text,
      option_1: line.option_1,
      option_2: line.option_2,
      option_3: line.option_3,
      option_4: line.option_4,
      option_1_count: 0,
      option_2_count: 0,
      option_3_count: 0,
      option_4_count: 0,
      option_correct: line.option_correct,
      Type: 'T',
      Keywords: 'test',
    }
    if (mapped.id.match(/^q[1-9]/)) {
      db('questions').push(mapped);
    }
  })
  .on('end', function () {
    console.log('Tests DONE');
    console.log('writing questions file');
    db.write();
    console.log('Questions Compiled', questionsFile);
  })
})
