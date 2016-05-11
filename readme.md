# OKCupid dataset stuff

1. Grab the data sources from [https://osf.io/p9ixw/](https://osf.io/p9ixw/)
2. Drop them in `data`
3. un7zip `user_data.7z`
4. Go nuts

## Inlcuded scripts

`npm run questions` will turn the questions file into a json file, `output/questions.json`.

`npm run answers` will match up the questions file into user answers and create an answers file, `output/answers.json`. Note, this takes a LONG time to run, like 12 hours on a beefy, modern day Macbook Pro.

`npm run start` will run both of the above, in order