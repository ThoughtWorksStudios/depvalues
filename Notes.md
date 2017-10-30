# Notes from address problem

## How to generate the CSV from DBF

Using `SITUS_ADDRESS_PT.dbf` from [http://geostor-vectors.geostor.org/Location/SHP/SITUS_ADDRESS_PT.zip]

```bash
# extract just the DBF
unzip -p SITUS_ADDRESS_PT.zip SITUS_ADDRESS_PT.dbf > SITUS_ADDRESS_PT.dbf

npm install

# creates SITUS_ADDRESS_PT.csv
npm run dbf SITUS_ADDRESS_PT.dbf
```

## Splitting the CSV into individual CSVs (zips.csv, states.csv, cities.csv, addresses.csv)

Granted, we didn't get a chance to use this. I had intended to use these to import into OrientDB, but it doesn't look like this is going to happen as we've learned enough from Neo4J, which is super-slow. But here it is anyway, for reference.

```bash
node conv.js SITUS_ADDRESS_PT.csv
```

## Neo4j Import

```cypher

// CSV file should be in the /imports folder in the neo4j installation

// create indexes to make matching faster (helps when creating relationships and running queries)
CREATE CONSTRAINT ON (s:State) ASSERT s.abbr IS UNIQUE;
CREATE CONSTRAINT ON (z:Zip) ASSERT z.code IS UNIQUE;

CREATE INDEX ON :City(name, state);
// CREATE CONSTRAINT ON (c:City) ASSERT (c.name, c.state) IS NODE KEY; // only on neo4j enterprise

CREATE INDEX ON :Address(label, city, zip9);
// CREATE CONSTRAINT ON (a:Address) ASSERT (a.label, a.city, a.zip9) IS NODE KEY; // only on neo4j enterprise

// import nodes from CSV

USING PERIODIC COMMIT
LOAD CSV WITH HEADERS FROM 'file:///SITUS_ADDRESS_PT.csv' as line
WITH line LIMIT 10000

FOREACH (ignore IN CASE WHEN trim(line.ADR_LABEL) <> "" THEN [1] ELSE [] END |
  MERGE (:State {abbr: line.ADR_STATE})
  MERGE (:Zip {code: line.ADR_ZIP5})
  MERGE (:City {name: line.ADR_CITY, state: line.ADR_STATE}) // city names are not unique, may exist in multiple states (e.g. Richmond, CA and Richmond, VA)
  MERGE (:Address {label: line.ADR_LABEL, city: line.ADR_CITY, zip9: line.ADR_ZIP9})
);

// create relationships as a separate step to avoid EAGER load

USING PERIODIC COMMIT
LOAD CSV WITH HEADERS FROM 'file:///SITUS_ADDRESS_PT.csv' as line
WITH line LIMIT 10000

MATCH (state:State) WHERE state.abbr=line.ADR_STATE
MATCH (zip:Zip) WHERE zip.code = line.ADR_ZIP5
MATCH (city:City) WHERE city.name = line.ADR_CITY AND city.state = line.ADR_STATE
MATCH (addr:Address) WHERE addr.label = line.ADR_LABEL AND addr.zip9 = line.ADR_ZIP9

MERGE (zip)  -[:IN]-> (state)
MERGE (city) -[:IN]-> (zip)
MERGE (city) -[:IN]-> (state)
MERGE (addr) -[:IN]-> (city)
MERGE (addr) -[:IN]-> (state)
MERGE (addr) -[:IN]-> (zip)

RETURN line.OBJECTID;
```

### Alternatively, one can omit relationships entirely as just use it like a table :)

```cypher

CREATE INDEX ON :Address(label, city, state, zip, zip9);

// Queries can be simpler and more straightforward by matching properites as with SQL.
// Certainly this has different performance characteristics. Insertion is faster, and
// some queries were faster, while some were not.

// ** NOTE: This has no clear advantage over SQL **

USING PERIODIC COMMIT
LOAD CSV WITH HEADERS FROM 'file:///SITUS_ADDRESS_PT.csv' as line
WITH line LIMIT 10000

FOREACH (ignore IN CASE WHEN trim(line.ADR_LABEL) <> "" THEN [1] ELSE [] END |
  MERGE (:Address {label: line.ADR_LABEL, city: line.ADR_CITY, state: line.ADR_STATE, zip: line.ADR_ZIP5, zip9: line.ADR_ZIP9})
);

```

## Postgres Import

```sql
-- create temporary table for raw data import
create temporary table t (OBJECTID varchar(255),ID varchar(255),ADR_NUM varchar(255),ADR_NUM_SU varchar(255),ADR_BLDG varchar(255),ADR_UNIT_T varchar(255),ADR_UNIT_I varchar(255),PRE_DIR varchar(255),PSTR_NAME varchar(255),PSTR_TYPE varchar(255),PSUF_DIR varchar(255),PSTR_MOD varchar(255),PSTR_FULNA varchar(255),LANDMARK_N varchar(255),ADR_PLACE varchar(255),ADR_MUNI varchar(255),ADR_CITY varchar(255),ADR_ZIP5 varchar(255),ADR_ZIP4 varchar(255),ADR_ZIP9 varchar(255),CNTY_NAME varchar(255),ADR_STATE varchar(255),ADR_LABEL varchar(255),ADR_BOX_TY varchar(255),ADR_BOX_ID varchar(255),ADR_BOXGRT varchar(255),ADR_BOXGRI varchar(255),ADR_BOX_LB varchar(255),LON_X varchar(255),LAT_Y varchar(255),FEA_TYP varchar(255),DATE_ED varchar(255),ADD_AUTH varchar(255),UID_TEXT varchar(255),APF_ID varchar(255),ADDR_HN varchar(255),ADDR_PD varchar(255),ADDR_PT varchar(255),ADDR_SN varchar(255),ADDR_ST varchar(255),ADDR_SD varchar(255),PRE_TYPE varchar(255),COMP_HN varchar(255));

-- create destination table
create table addresses (id serial, label varchar(255), city varchar(255), state char(2), zipcode char(5), zip9 char(10));

-- initial CSV import
copy t (OBJECTID,ID,ADR_NUM,ADR_NUM_SU,ADR_BLDG,ADR_UNIT_T,ADR_UNIT_I,PRE_DIR,PSTR_NAME,PSTR_TYPE,PSUF_DIR,PSTR_MOD,PSTR_FULNA,LANDMARK_N,ADR_PLACE,ADR_MUNI,ADR_CITY,ADR_ZIP5,ADR_ZIP4,ADR_ZIP9,CNTY_NAME,ADR_STATE,ADR_LABEL,ADR_BOX_TY,ADR_BOX_ID,ADR_BOXGRT,ADR_BOXGRI,ADR_BOX_LB,LON_X,LAT_Y,FEA_TYP,DATE_ED,ADD_AUTH,UID_TEXT,APF_ID,ADDR_HN,ADDR_PD,ADDR_PT,ADDR_SN,ADDR_ST,ADDR_SD,PRE_TYPE,COMP_HN)
from '/Users/kierarad/Development/studios/dependent_values/SITUS_ADDRESS_PT.csv'
with (format csv);

-- insert only desired data into destination table
insert into addresses (label, city, state, zipcode, zip9) select ADR_LABEL, ADR_CITY, ADR_STATE, ADR_ZIP5, ADR_ZIP9 from t;

-- cleanup
drop table t;
```

## Queries:

Give me a random address from x, y zipcodes:

SQL:

```sql
select label || ', ' || city || ', ' || state || ' ' || zip9 from addresses where zipcode in ('72160', '72042') order by random() limit 1;
```

Neo4J:

```cypher
MATCH (z:Zip) WHERE z.code IN ['72160', '72042']
MATCH (a:Address) -[:IN]-> (z)
MATCH (s:State) <-[:IN]- (a)
  WITH a, s, rand() as r
  RETURN a.label + ", " + a.city + ", " + s.abbr + ", " + a.zip9 AS address
  ORDER BY r
  LIMIT 1;
```

Alternate Neo4J:

```cypher
MATCH (a:Address) WHERE a.zip IN ['72160', '72042']
  WITH a, rand() AS r
  RETURN a.label + ", " + a.city + ", " + a.state + ", " + a.zip9 AS address
  ORDER BY r
  LIMIT 1;
```

Give me a random address in city, state:

SQL:

```sql
select label || ', ' || city || ', ' || state || ' ' || zip9 from addresses where city = 'De Witt' and state = 'AR'  order by random() limit 1;
```

Neo4J:

```cypher
MATCH (c:City) WHERE c.name = 'De Witt' AND c.state = 'AR'
MATCH (a:Address) -[:IN]-> (c)
  WITH a, c, rand() as r
  RETURN a.label + ", " + a.city + ", " + c.state + ", " + a.zip9 AS address
  ORDER BY r
  LIMIT 1;
```

Alternate Neo4J:

```cypher
MATCH (a:Address) WHERE a.city = 'De Witt' AND a.state = 'AR'
  WITH a, rand() AS r
  RETURN a.label + ", " + a.city + ", " + a.state + ", " + a.zip9 AS address
  ORDER BY r
  LIMIT 1;
```

Give me a random address from AR, TX, or MO:

SQL:

```sql
select label || ', ' || city || ', ' || state || ' ' || zip9 from addresses where state in ('AR', 'TX', 'MO')  order by random() limit 1;
```

Neo4J:

```cypher
MATCH (s:State) WHERE s.abbr IN ['AR', 'TX', 'MO']
MATCH (a:Address) -[:IN]-> (s)
  WITH a, s, rand() as r
  RETURN a.label + ", " + a.city + ", " + s.abbr + ", " + a.zip9 AS address
  ORDER BY r
  LIMIT 1;
```

Alternate Neo4J:

```cypher
MATCH (a:Address) WHERE a.state IN ['AR', 'TX', 'MO']
  WITH a, rand() AS r
  RETURN a.label + ", " + a.city + ", " + a.state + ", " + a.zip9 AS address
  ORDER BY r
  LIMIT 1;
```

## Findings

### PostgreSQL

PostgreSQL is really fast. Insertion of 1.5M rows was within seconds -- maybe 3 seconds? All queries were fast on a single table design with no indexing. Indexing by zip5, state, and city would have certainly yielded even faster results as the cardinality is pretty good.

### Neo4J

Vertex creation from LOAD CSV was tolerable, but not fast. Creating relationships was horribly slow, in part due to requiring MERGE, which essentially must MATCH, then CREATE. Indexing, per recommendation in the official documentation, did not help in any significant way. In the end, we had to reduce the set to 10,000 rows instead of the 1.5M (which would have taken at least a couple of days non-stop to finish).

Query performance was quite slow by comparison. We also did not feel that the relationship modeling added any value. We did another experiment, omitting relationships entirely, by storing all the address attributes in the vertex (we realize that this defeats the purpose of a graph database). Query by city+state was about 4x faster, but other queries were about the same. Either way, no advantage over SQL

### Is solving this worth it?

The hardest part was finding data that was cohesive. We searched for several hours for address data that was collated, but mostly we only found list of ZIP codes and cities, GPS coordinates, and such. We tried searching the US Census for data, but there wasn't anything put together for us, until we tried [https://www.data.gov] and found address data from the Arkansas State Government. Once we had the data, the rest was not terribly interesting to solve, so maybe it's not a solution worth our efforts.
