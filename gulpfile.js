'use strict';

import browserify from 'browserify';
import gulp from 'gulp';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import uglify from 'gulp-uglify';
import rename from 'gulp-rename';
import replace from 'gulp-replace';
import coveralls from 'gulp-coveralls';
import istanbul from 'gulp-istanbul';
import mocha from 'gulp-mocha';
import sourcemaps from 'gulp-sourcemaps';
import log from 'gulplog';

var paths = {
  index: './index.js',
  tests: './test/**/*.js'
};

console.info(mocha);

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

gulp.task('dist', function() {
  var b = browserify({
    entries: paths.index,
    basedir: './',
    debug: false,
    standalone: 'objectHash',
    insertGlobals : false,
    bundleExternal: false,
    bare: true,
  });
  b.external('crypto');
  b.require('crypto');
  // b.external('buffer');
  // b.exclude('buffer');
  // b.ignore('buffer');

  return b.bundle()
    .pipe(source('object_hash.js'))
    .pipe(buffer())
    // .pipe(sourcemaps.init({loadMaps: true}))
    .on('error', log.error)
    // .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist'))
    .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest('./dist'))
});


//     function() {
//       // gulp expects tasks to return a stream, so we create one here.
//       var bundledStream = through();

//       bundledStream
//         .pipe(source('object_hash_test.js'))
//         .pipe(buffer())
//         // .pipe(sourcemaps.init({loadMaps: true}))
//         // .pipe(uglify())
//         .on('error', log.error)
//         // .pipe(sourcemaps.write('./'))
//         .pipe(gulp.dest('./dist'));

//       globby([paths.tests]).then(function(entries) {
//         var b = browserify({
//           entries: entries,
//           basedir: './tests',
//           debug: false,
//         });

//         b.bundle().pipe(bundledStream);
//       });

//       return bundledStream;
//     },
//   ], cb);
// });

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
