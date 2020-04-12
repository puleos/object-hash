import { uglify } from "rollup-plugin-uglify";

export default {
  input: 'index.js',
  output: {
    file: 'dist/object_hash.js',
    format: 'umd',
    compact: true,
  },
  plugins: [uglify()]
};
