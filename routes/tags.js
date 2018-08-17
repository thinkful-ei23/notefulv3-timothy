'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Tag = require('../models/tag');
const Note = require('../models/note');

// GET all /tags
router.get('/', (req, res, next) => {
  Tag.find()
    .sort({ name: 'asc' })
    .then(result => {
      res.json(result);
    })
    .catch(err => next(err));
});
// GET /tags by id
router.get('/:id', (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('The `id` is invalid');
    err.status = 400;
    next(err);
  }

  Tag.findById(id)
    .then(result => {
      if (result) {
        res.json(result);
      } else {
        next();
      }
    })
    .catch(err => next(err));
});

// POST /tags to create a new tag
router.post('/', (req, res, next) => {
  const { name } = req.body;
  if (!name) {
    const err = new Error('Missing `name` from request body');
    err.status = 400;
    next(err);
  }
  const newTag = { name };

  Tag.create(newTag)
    .then(result => {
      res
        .location(`${req.originalUrl}/${result.id}`)
        .status(201)
        .json(result);
    })
    .catch(err => {
      if (err.code === 11000) {
        err = new Error('This tag `name` already exist');
        err.status = 400;
      }
      next(err);
    });
});

// PUT /tags by id to update a tag
router.put('/:id', (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('The `id` is invalid');
    err.status = 400;
    next(err);
  }
  const { name } = req.body;
  if (!name) {
    const err = new Error('Missing `name` in request body');
    err.status = 400;
    next(err);
  }
  const updateTag = { name };

  Tag.findByIdAndUpdate(id, updateTag, { new: true })
    .then(result => {
      if (result) {
        res.json(result);
      } else {
        next();
      }
    })
    .catch(err => {
      if (err.code === 11000) {
        err = new Error('This tag `name` already exist');
        err.status = 400;
      }
      next(err);
    });
});
// DELETE /tags by id deletes the tag AND removes it from the notes collection
router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('The `id` is invalid');
    err.status = 400;
    next(err);
  }

  const tagRemovePromise = Tag.findByIdAndRemove(id);
  // const noteRemovePromise = Note.update({}, {$pull: {tags: id}}, {multi:true});
  const noteRemovePromise = Note.updateMany(
    { tags: id },
    { $pull: { tags: id } }
  );

  Promise.all([tagRemovePromise, noteRemovePromise])
    .then(([result]) => {
      if (result) {
        res.status(204).end();
      } else {
        next();
      }
    })
    .catch(err => next(err));
});
module.exports = router;
