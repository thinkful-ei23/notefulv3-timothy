'use strict';
const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config');

const Note = require('../models/note');
console.log(MONGODB_URI);
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    const searchTerm = 'lady gaga';
    let filter = {};

    if (searchTerm) {
      filter.title = { $regex: searchTerm };
    }

    return Note.find(filter).sort({ updatedAt: 'desc' });
  })
  .then(results => {
    console.log(results);
  })
  .then(() => {
    return mongoose.disconnect();
  })
  .catch(err => {
    console.error(`ERROR: ${err.message}`);
    console.error(err);
  });
