'use strict';

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var exec = require('gulp-exec');
var stylish = require('jshint-stylish');
var browserify = require('gulp-browserify');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var karma = require('karma');

var paths = {
  index: './index.js',
  tests: './test/**/*.js'
};

function test(src){
  gulp.src(src, { read: false } )
    .pipe(exec('mocha <%= file.path %>')
      .on('error', function(err){ console.log(err.message); }));
}

function testKarma(done){
  new karma.Server({
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
  gulp.src([paths.index])
    .pipe(browserify({
      insertGlobals : true,
      debug: true,
      standalone: 'objectHash'
    }))
    .pipe(rename('object_hash.js'))
    .pipe(uglify({outSourceMap: true}))
    .pipe(gulp.dest('./dist'));
    // tests
  gulp.src([paths.tests])
    .pipe(browserify())
    .pipe(rename('object_hash_test.js'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('test', function() {
  test([paths.tests]);
});

gulp.task('karma', function() {
  testKarma();
});

gulp.task('lint', function () {
  return lint([paths.index, paths.tests]);
});

gulp.task('watch', function () {

  // watch and lint any files that are added or changed
  gulp.watch([paths.index, paths.tests], function(event){
    if(event.type !== 'deleted') {
      lint([event.path]);
    }
  });

  // run the tests when something changes
  gulp.watch([paths.index, paths.tests], ['test', 'karma']);

});

gulp.task('default', ['watch']);
