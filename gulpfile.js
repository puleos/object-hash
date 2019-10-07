'use strict';

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var exec = require('gulp-exec');
var stylish = require('jshint-stylish');
var browserify = require('gulp-browserify');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var coveralls = require('gulp-coveralls');
var istanbul = require('gulp-istanbul');
var mocha = require('gulp-mocha');

var paths = {
  index: './index.js',
  tests: './test/**/*.js'
};

function preTest(src) {
  return gulp.src(src)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
}

function test(src){
  return gulp.src(src)
    .pipe(mocha())
    .pipe(istanbul.writeReports());
}

function testKarma(done){
  if (+process.version.split('.')[0].slice(1) < 8) {
    console.log('karma does not support Node.js < 8, skipping');
    return done();
  }
  new (require('karma').Server)({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
}

function lint(src){
  return gulp.src(src)
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter(stylish));
}

gulp.task('dist', function(){
  return Promise.all([
    gulp.src([paths.index])
      .pipe(browserify({
        insertGlobals : true,
        debug: true,
        standalone: 'objectHash'
      }))
      .pipe(rename('object_hash.js'))
      .pipe(uglify())
      .pipe(gulp.dest('./dist')),
    gulp.src([paths.tests])
      .pipe(browserify())
      .pipe(rename('object_hash_test.js'))
      .pipe(gulp.dest('./dist'))
  ]);
});

gulp.task('pre-test', function() {
  return preTest([paths.index]);
});

gulp.task('test', gulp.series('pre-test', function() {
  return test([paths.tests]);
}));

gulp.task('karma', function(done) {
  testKarma(done);
});

gulp.task('coveralls', function() {
  return gulp.src('coverage/**/lcov.info')
    .pipe(coveralls());
});

gulp.task('lint', function () {
  return lint([paths.index]);
});
