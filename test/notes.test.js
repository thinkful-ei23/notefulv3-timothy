'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');

const app = require('../server');

const { TEST_MONGODB_URI } = require('../config');

const Note = require('../models/note');
const Folder = require('../models/folder');
const Tag = require('../models/tag');

const seedNotes = require('../db/seed/notes');
const seedFolders = require('../db/seed/folders');
const seedTags = require('../db/seed/tags');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Noteful API resource', function() {
  before(function() {
    return mongoose
      .connect(
        TEST_MONGODB_URI,
        { useNewUrlParser: true }
      )
      .then(() => mongoose.connection.db.dropDatabase());
  });

  beforeEach(function() {
    return Promise.all([
      Note.insertMany(seedNotes),

      Folder.insertMany(seedFolders),
      Folder.createIndexes(),

      Tag.insertMany(seedTags),
      Tag.createIndexes()
    ]);
  });

  afterEach(function() {
    return mongoose.connection.db.dropDatabase();
  });

  after(function() {
    return mongoose.disconnect();
  });

  describe('GET endpoints', () => {
    it('should return all existing notes', () => {
      let res;
      return chai
        .request(app)
        .get('/api/notes')
        .then(results => {
          res = results;
          expect(res).to.have.status(200);
          expect(res.body).to.have.lengthOf.at.least(1);
          return Note.count();
        })
        .then(count => {
          expect(res.body).to.have.lengthOf(count);
        });
    });

    it('should return all notes with correct fields', () => {
      let noteHolder;
      return chai
        .request(app)
        .get('/api/notes')
        .then(result => {
          expect(result).to.have.status(200);
          expect(result).to.be.json;
          expect(result.body).to.be.a('array');
          expect(result.body).to.have.lengthOf.at.least(1);
          result.body.forEach(note => {
            expect(note).to.be.a('object');
            expect(note).to.include.keys(
              'id',
              'title',
              'content',
              'createdAt',
              'updatedAt',
              'folderId',
              'tags'
            );
          });
          noteHolder = result.body[0];
          return Note.findById(noteHolder.id);
        })
        .then(note => {
          expect(noteHolder.id).to.equal(note.id);
          expect(noteHolder.title).to.equal(note.title);
          expect(noteHolder.content).to.equal(note.content);
          expect(noteHolder.folderId).to.equal(note.folderId.toString());
          // expect(noteHolder.tags).to.equal(note.tags);
          expect(new Date(noteHolder.createdAt)).to.eql(note.createdAt);
          expect(new Date(noteHolder.updatedAt)).to.eql(note.updatedAt);
        });
    });

    it('should return note with given `searchTerm` query', () => {
      const searchTerm = 'gaga';
      const re = new RegExp(searchTerm, 'i');
      const dbPromise = Note.find({
        $or: [{ title: re }, { content: re }]
      });

      const apiPromise = chai
        .request(app)
        .get(`/api/notes?searchTerm=${searchTerm}`);
      return Promise.all([dbPromise, apiPromise]).then(([data, res]) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('array');
        expect(res.body).to.have.length(1);
        res.body.forEach(function(item, i) {
          expect(item).to.be.a('object');
          expect(item).to.include.all.keys(
            'id',
            'title',
            'createdAt',
            'updatedAt'
          );
          expect(item.id).to.equal(data[i].id);
          expect(item.title).to.equal(data[i].title);
          expect(item.content).to.equal(data[i].content);
          expect(new Date(item.createdAt)).to.eql(data[i].createdAt);
          expect(new Date(item.updatedAt)).to.eql(data[i].updatedAt);
        });
      });
    });

    it('should return correct search result for a folderId query', () => {
      let data;
      return Folder.findOne()
        .then(_data => {
          data = _data;
          return Promise.all([
            Note.find({ folderId: data.id }),
            chai.request(app).get(`/api/notes?folderId=${data.id}`)
          ]);
        })
        .then(([data, res]) => {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(data.length);
        });
    });

    it('should return an empty array for an incorrect query', function() {
      const searchTerm = 'NotValid';
      // const re = new RegExp(searchTerm, 'i');
      const dbPromise = Note.find({
        title: { $regex: searchTerm, $options: 'i' }
        // $or: [{ 'title': re }, { 'content': re }]
      });
      const apiPromise = chai
        .request(app)
        .get(`/api/notes?searchTerm=${searchTerm}`);
      return Promise.all([dbPromise, apiPromise]).then(([data, res]) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('array');
        expect(res.body).to.have.length(data.length);
      });
    });

    describe('GET /api/notes/:id', () => {
      it('should return note with correct id given id', () => {
        let res;
        return Note.findOne()
          .then(note => {
            res = note;
            return chai.request(app).get(`/api/notes/${res.id}`);
          })
          .then(result => {
            expect(result).to.be.status(200);
            expect(result).to.be.json;
            expect(result.body).to.be.a('object');
            expect(result.body).to.include.keys(
              'id',
              'title',
              'content',
              'createdAt',
              'updatedAt',
              'folderId',
              'tags'
            );
            expect(result.body.id).to.equal(res.id);
            expect(result.body.title).to.equal(res.title);
            expect(result.body.content).to.equal(res.content);
            return Note.findById(res.id);
          })
          .then(note => {
            expect(res.id).to.equal(note.id);
            expect(res.title).to.equal(note.title);
            expect(res.content).to.equal(note.content);
            expect(new Date(res.createdAt)).to.eql(note.createdAt);
            expect(new Date(res.updatedAt)).to.eql(note.updatedAt);
          });
      });

      it('should give a 404 not found ', () => {
        const emptyId = '990000000000000000000003';
        return chai
          .request(app)
          .get(`/api/notes/${emptyId}`)
          .then(res => {
            expect(res).to.have.status(404);
          });
      });

      it('should give a 400 with invalid id', () => {
        const invalidId = '1';
        return chai
          .request(app)
          .get(`/api/notes/${invalidId}`)
          .then(res => {
            expect(res).to.have.status(400);
          });
      });
    });
  });

  describe('POST endpoints', () => {
    it('should add a new note', () => {
      const newNote = {
        title: 'When my dog is hungry, I ask Lady Gaga',
        content: 'Ah ah romma romma'
      };

      let res;
      return chai
        .request(app)
        .post('/api/notes')
        .send(newNote)
        .then(_res => {
          res = _res;
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'id',
            'title',
            'content',
            'createdAt',
            'updatedAt',
            'tags'
          );
          expect(res.body.id).to.not.be.null;
          expect(res.body.title).to.equal(newNote.title);
          expect(res.body.content).to.equal(newNote.content);
          return Note.findById(res.body.id);
        })
        .then(note => {
          expect(res.body.id).to.equal(note.id);
          expect(res.body.title).to.equal(note.title);
          expect(res.body.content).to.equal(note.content);
          expect(new Date(res.body.createdAt)).to.eql(note.createdAt);
          expect(new Date(res.body.updatedAt)).to.eql(note.updatedAt);
        });
    });

    it('should return 400 for missing title', () => {
      const badNewNote = {
        content: 'Ah ah romma romma When my dog is hungry, I ask Lady Gaga'
      };

      return chai
        .request(app)
        .post('/api/notes')
        .send(badNewNote)
        .then(res => {
          expect(res).to.have.status(400);
        });
    });
  });

  describe('PUT endpoints', () => {
    it('should update a note with given id', () => {
      const updateNote = {
        title: 'fofofofofofofof',
        content: 'futuristic fusion'
      };
      let res;
      return Note.findOne()
        .then(note => {
          updateNote.id = note.id;
          return chai
            .request(app)
            .put(`/api/notes/${note.id}`)
            .send(updateNote);
        })
        .then(_res => {
          res = _res;
          expect(res).to.have.status(200);
          return Note.findById(updateNote.id);
        })
        .then(note => {
          expect(res.body.id).to.equal(note.id);
          expect(res.body.title).to.equal(note.title);
          expect(res.body.content).to.equal(note.content);
          expect(new Date(res.body.createdAt)).to.eql(note.createdAt);
          expect(new Date(res.body.updatedAt)).to.eql(note.updatedAt);
        });
    });

    it('should give a 400 with invalid id', () => {
      const invalidId = '1';
      return chai
        .request(app)
        .put(`/api/notes/${invalidId}`)
        .then(res => {
          expect(res).to.have.status(400);
        });
    });
  });

  describe('DELETE /api/notes/:id', function() {
    it('should delete an existing document and respond with 204', function() {
      let data;
      return Note.findOne()
        .then(_data => {
          data = _data;
          return chai.request(app).delete(`/api/notes/${data.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return Note.count({ _id: data.id });
        })
        .then(count => {
          expect(count).to.equal(0);
        });
    });
  });
});
