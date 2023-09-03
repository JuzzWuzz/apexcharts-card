import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";
import terser from "@rollup/plugin-terser";
import typescript from "rollup-plugin-typescript2";

const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ["./dist"],
  host: "0.0.0.0",
  port: 5001,
  allowCrossOrigin: true,
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
};

// The order is important!
const plugins = [
  nodeResolve({}),
  commonjs(),
  typescript(),
  json(),
  babel({
    exclude: "node_modules/**",
    babelHelpers: "bundled",
  }),
  dev && serve(serveopts),
  !dev &&
    terser({
      compress: {
        drop_console: false,
        pure_funcs: ["console.log"],
      },
      format: {
        comments: false,
      },
      mangle: {
        safari10: true,
      },
    }),
];

export default [
  {
    input: "src/apexcharts-card.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: dev ? true : false,
      globals: {
        apexcharts: "ApexCharts",
      },
    },
    plugins: [...plugins],
    watch: {
      exclude: "node_modules/**",
      chokidar: {
        usePolling: true,
        paths: "src/**",
      },
    },
  },
];
