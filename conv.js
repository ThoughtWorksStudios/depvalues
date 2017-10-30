const path = require("path");

if (!process.argv[2]) {
  console.error(`${path.basename(process.argv[1])} takes an input file (CSV)`);
  process.exit(1);
}

const fs = require("fs"),
     csv = require("fast-csv");

let input = fs.createReadStream(process.argv[2]),
     zips = csv.createWriteStream({headers: true}),
   states = csv.createWriteStream({headers: true}),
   cities = csv.createWriteStream({headers: true}),
    addrs = csv.createWriteStream({headers: true});

zips.pipe(fs.createWriteStream("zips.csv"));
states.pipe(fs.createWriteStream("states.csv"));
cities.pipe(fs.createWriteStream("cities.csv"));
addrs.pipe(fs.createWriteStream("addresses.csv"));

let z = {}, c = {}, s = {};

csv.fromStream(input, {headers: true, trim: true, escape: "\'"}).on("data", (data) => {
  if (data.ADR_LABEL && "" !== data.ADR_LABEL) {
    addrs.write({label: data.ADR_LABEL, city: data.ADR_CITY, state: data.ADR_STATE, zip9: data.ADR_ZIP9});

    let city = [data.ADR_CITY, data.ADR_STATE].join(",");

    if (!c[city]) {
      cities.write({name: data.ADR_CITY, state: data.ADR_STATE});
      c[city] = true;
    }

    if (!s[data.ADR_STATE]) {
      states.write({name: data.ADR_STATE});
      s[data.ADR_STATE] = true;
    }

    if (!z[data.ADR_ZIP5]) {
      zips.write({code: data.ADR_ZIP5});
      z[data.ADR_ZIP5] = true;
    }
  }
}).on("end", () => {
  addrs.end();
  cities.end();
  states.end();
  zips.end();
});
