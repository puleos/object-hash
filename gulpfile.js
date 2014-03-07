'use strict';

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var exec = require('gulp-exec');
var stylish = require('jshint-stylish');

var paths = {
  index: './index.js',
  tests: './test/**/*.js'
};

function test(src){
  return gulp.src(src, { read: false } )
    .pipe(exec('node <%= file.path %>')
      .on('error', function(err){ console.log(err.message); }));
}

function lint(src){
  return gulp.src(src)
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter(stylish));
}

gulp.task('test', function() {
  test([paths.tests]);
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
  gulp.watch([paths.index, paths.tests], ['test']);

});

gulp.task('default', ['watch']);
