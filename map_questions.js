var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

var dbPath = 'db/questions';
rimraf.sync(path.resolve(dbPath));
var PouchDB = require('pouchdb');
var db = new PouchDB(dbPath);
var tasks = [];

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
    var op = db.put({
      _id: line.id,
      text: line.text,
      option_1: line.option_1,
      option_2: line.option_2,
      option_3: line.option_3,
      option_4: line.option_4,
      N: line.N,
      Type: line.Type,
      Order: line.Order,
      Keywords: line.Keywords,
      option_1_count: 0,
      option_2_count: 0,
      option_3_count: 0,
      option_4_count: 0
    })
    .catch(function (err) {
      console.log('ERR', line.id, err);
      throw err;
    });
    tasks.push(op);
  }
})
.on('end', function () {
  console.log('Questions DONE');

  fs.createReadStream(path.join(__dirname, 'data', 'test_items.csv'))
  .pipe(testParser)
  .on('data', function (line) {
    if (line.id.match(/^q[1-9]/)) {
      var op = db.get(line.id)
      .then(function (doc) {
        doc.option_correct = line.option_correct;
        doc.Keywords += '; test';
        return db.put(doc);
      })
      .catch(function (err) {
        if (err.status === 404) return;
        console.log('ERR', line.id, err);
        throw err;
      });
      tasks.push(op);
    }
  })
  .on('end', function () {
    console.log('Tests DONE');

    Promise.all(tasks)
    .then(function () {
      console.log('Questions compiled successfully');
    })
    .catch(function (err) {
      console.log('ERROR');
      console.log(err);
    })
  })
})
