# OKCupid dataset indexer

Indexes Open Science Framework's [OKCupid very large public dataset](https://osf.io/p9ixw/)

1. Grab the data sources from [https://osf.io/p9ixw/](https://osf.io/p9ixw/) (you need the csv's and 7z from the data dir)
2. Drop them in `data`
3. un-7zip `user_data.7z` in place (you can delete it afterward)
4. Use `npm start` to index into PouchDB (under `db`)

## Included scripts

`npm run questions` will index all the questions.

`npm run answers` index the users and answers, and tally up the answer counts in the questions database. This takes a while to run; on a modern day Macbook Pro, it takes about an hour.

`npm run start` will run both of the above, in order.

## Using the data

Just access the data using [PouchDB](https://github.com/pouchdb/pouchdb):

```js
var PouchDB = require('pouchdb');
var questions = new PouchDB('db/questions');
var answers = new PouchDB('db/answers');

// do pouch things
```

You should be able to use [levelup](https://github.com/Level/levelup) too, since that's what Pouch is using behind the scenes.