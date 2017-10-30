const path = require("path");

if (!(process.argv[2] && process.argv[2].match(/\.dbf$/i))) {
  console.error(`${path.basename(process.argv[2])} takes an input file (*.dbf)`);
  process.exit(1);
}

/**
 * Replacement for the node-dbf executable, as the packaged one does not properly escape quotes
 */

const fs = require("fs"),
     csv = require("fast-csv"),
  Parser = require("node-dbf");

let infile = process.argv[2],
   outfile = infile.replace(/\.dbf$/i, ".csv"),
    stream = csv.createWriteStream({headers: true});

let timeStart = process.hrtime(), fields, parser = new Parser(infile);

stream.pipe(fs.createWriteStream(outfile));

parser.on("header", function(header) {
  fields = header.fields.map(function(f) { return f.name; });
  stream.write(fields);
});

parser.on("record", function(record) {
  let len = fields.length, data = new Array(len);

  for (let i = 0; i < len; ++i) {
    data[i] = (record[fields[i]]);
  }

  stream.write(data);
});

parser.on("end", function() {
  console.error(`Completed file conversion`);
});

parser.parse();
