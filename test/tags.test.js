'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');

const app = require('../server');

const { TEST_MONGODB_URI } = require('../config');

const Tag = require('../models/tag');
const Note = require('../models/note');

const seedTags = require('../db/seed/tags');
const seedNotes = require('../db/seed/notes');

const expect = chai.expect;

chai.use(chaiHttp);

describe('Noteful Api resource', () => {
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
      Tag.insertMany(seedTags)
    ]).then(() => {
      return Note.createIndexes();
    });
  });
  afterEach(function() {
    return mongoose.connection.db.dropDatabase();
  });

  after(function() {
    return mongoose.disconnect();
  });

  describe('GET endpoints', () => {
    it('should GET all tags', () => {
      return Promise.all([Tag.find(), chai.request(app).get('/api/tags')]).then(
        ([data, res]) => {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.length(data.length);
        }
      );
    });
    it('should GET all tags with correct fields', () => {
      return Promise.all([
        Tag.find().sort('name'),
        chai.request(app).get('/api/tags')
      ]).then(([data, res]) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res.body).to.be.a('array');
        expect(res.body).to.have.length(data.length);
        res.body.forEach((tag, i) => {
          expect(tag).to.be.a('object');
          expect(tag).to.have.all.keys('id', 'name', 'createdAt', 'updatedAt');
          expect(tag.id).to.be.equal(data[i].id);
          expect(tag.name).to.be.equal(data[i].name);
          expect(new Date(tag.createdAt)).to.eql(data[i].createdAt);
          expect(new Date(tag.updatedAt)).to.eql(data[i].updatedAt);
        });
      });
    });
    it('should GET tag with given id', () => {
      let res;
      return Tag.findOne()
        .then(tag => {
          res = tag;
          return chai.request(app).get(`/api/tags/${res.id}`);
        })
        .then(result => {
          expect(result).to.have.status(200);
          expect(result).to.be.json;
          expect(result.body).to.be.a('object');
          expect(result.body).to.have.all.keys(
            'id',
            'name',
            'createdAt',
            'updatedAt'
          );
          expect(result.body.id).to.equal(res.id);
          expect(result.body.name).to.equal(res.name);
          expect(new Date(result.body.createdAt)).to.eql(res.createdAt);
          expect(new Date(result.body.updatedAt)).to.eql(res.updatedAt);
        });
    });

    it('should give a 404 not found ', () => {
      const emptyId = '990000000000000000000003';
      return chai
        .request(app)
        .get(`/api/tags/${emptyId}`)
        .then(res => {
          expect(res).to.have.status(404);
        });
    });

    it('should give a 400 with invalid id', () => {
      const invalidId = '1';
      return chai
        .request(app)
        .get(`/api/tags/${invalidId}`)
        .then(res => {
          expect(res).to.have.status(400);
        });
    });
  });

  describe('POST endpoints', () => {
    it('should add new tag', () => {
      const newTag = {
        name: 'Holla'
      };

      let body;
      return chai
        .request(app)
        .post('/api/tags')
        .send(newTag)
        .then(result => {
          body = result.body;
          expect(result).to.have.status(201);
          expect(result).to.have.header('location');
          expect(result).to.be.json;
          expect(body).to.be.a('object');
          expect(body).to.have.all.keys('id', 'name', 'createdAt', 'updatedAt');
          return Tag.findById(body.id);
        })
        .then(result => {
          expect(body.id).to.equal(result.id);
          expect(body.name).to.equal(result.name);
          expect(new Date(body.createdAt)).to.eql(result.createdAt);
          expect(new Date(body.updatedAt)).to.eql(result.updatedAt);
        });
    });

    it('should return a 400 error for missing `name` field', () => {
      const badTag = { monkies: 'are cool' };

      return chai
        .request(app)
        .post('/api/tags')
        .send(badTag)
        .then(result => {
          expect(result).to.be.json;
          expect(result).to.have.status(400);
        });
    });

    // // In the works
    // it('should return a 400 error for repeated `name` field', () => {
    //   const badTag1 = { name : 'breed'};
    //   const badTag2 = { name : 'breed'};
    //   // chai.request(app).post('/api/tags').send(badTag2)
    //   return chai
    //     .request(app).post('/api/tags').send(badTag1)
    //     .then(result => {
    //       console.log(result.status);
    //       return chai.request(app).post('/api/tags').send(badTag2);
    //     })
    //     .then(result => {
    //       console.log(result.status);
    //     });
    // });
  });

  describe('PUT endpoints', () => {
    it('should update a tag with given id', () => {
      const updateTag = { name: 'foobizzbang' };

      let res;
      return Tag.findOne()
        .then(result => {
          return chai
            .request(app)
            .put(`/api/tags/${result.id}`)
            .send(updateTag);
        })
        .then(result => {
          res = result;
          expect(res).to.have.status(200);
          return Tag.findById(res.body.id);
        })
        .then(result => {
          expect(res.body.id).to.equal(result.id);
          expect(res.body.name).to.equal(result.name);
          expect(new Date(res.body.updatedAt)).to.eql(result.updatedAt);
          expect(new Date(res.body.createdAt)).to.eql(result.createdAt);
        });
    });

    it('should return a 404 when empty id is used', () => {
      const updateTag = { name: 'blitzbangbar' };
      const emptyId = '990000000000000000000003';

      return chai
        .request(app)
        .put(`/api/tags/${emptyId}`)
        .send(updateTag)
        .then(result => {
          expect(result).to.have.status(404);
        });
    });

    it('should return 400 missing name when missing name in body', () => {
      const updateTag = { fandoms: 'foobizzbang' };

      return Tag.findOne()
        .then(result => {
          return chai
            .request(app)
            .put(`/api/tags/${result.id}`)
            .send(updateTag);
        })
        .then(result => {
          expect(result).to.have.status(400);
        });
    });

    it('should return a 400 invalid id when given invalid id', () => {
      const updateTag = { name: 'blitzbangbar' };
      const invalidId = 'abc';

      return chai
        .request(app)
        .put(`/api/tags/${invalidId}`)
        .send(updateTag)
        .then(result => {
          expect(result).to.have.status(400);
        });
    });
  });

  describe('DELETE /api/tags/:id', function() {
    it('should delete an existing document and respond with 204', function() {
      let data;
      return Tag.findOne()
        .then(_data => {
          data = _data;
          return chai.request(app).delete(`/api/tags/${data.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          expect(res.body).to.be.empty;
          return Tag.count({ _id: data.id });
        })
        .then(count => {
          expect(count).to.equal(0);
        });
    });
  });
});
