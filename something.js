const path = require("path");
const express = require("express");
const app = express();
const fs = require("fs");
const bodyParser = require("body-parser");
let portNumber;

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};

const { MongoClient, ServerApiVersion } = require("mongodb");


let api = "https://pokeapi.co/api/v2/pokemon";

function addMons(list, url) {
  return fetch(url)
    .then((response) => response.json())
    .then((json) => {
      for (x in json.results) {
        list.push(json.results[x]);
      }
      if (json.next != null) {
        return addMons(list, json.next);
      }
      return list;
    });
}

async function main() {
  const uri = `mongodb+srv://${userName}:${password}@cluster0.ypkisgo.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });

  try {
    await client.connect();

    addMons(new Array(), api)
      .then((result) => {
        //retrieving the port number from user input
        process.stdin.setEncoding("utf8");
        portNumber = process.argv[2];

        app.listen(portNumber);
        console.log(`Web server is running at http://localhost:${portNumber}`);

        const prompt = "Stop to shutdown the server: ";

        process.stdout.write(prompt);

        //checking if the given message in console is "stop"
        process.stdin.on("readable", function () {
          let dataInput = process.stdin.read();
          if (dataInput !== null) {
            let command = dataInput.trim();
            if (command == "stop") {
              process.stdout.write(`Shutting down the server`);
              process.exit(0);
            }
            if (command == "list") {
              console.log(result);
            }
            process.stdout.write(prompt);
            process.stdin.resume();
          }
        });

        app.set("views", path.resolve(__dirname, "templates"));
        app.set("view engine", "ejs");

        app.get("/", (request, response) => {
          response.render("index");
        });

        app.get("/search", (request, response) => {
          response.render("search");
        });

        app.use(bodyParser.urlencoded({ extended: false }));

        //your search will be stored in mongo here
        app.post("/search", async (request, response) => {
          let count = 0;
          let str = request.body.pokename;
          let table = "";
          table +=
            "<table border=1><tr><th>Name</th><th>Normal Sprite</th><th>Shiny Sprite</th></tr>";

          if (str != "" && str != "random") {
            for (const pokemon of result) {
              if (pokemon.name.includes(str)) {
                count = count + 1;
                let response = await fetch(pokemon.url);
                let json = await response.json();
                spriteShiny = json.sprites.front_shiny;
                spriteNormal = json.sprites.front_default;

                table += `<tr><td>${pokemon.name}</td><td> <img src="${spriteNormal}" alt=${pokemon.name}> </td>
                    <td> <img src="${spriteShiny}" alt=${pokemon.name}> </td></tr>`;
              }
            }
          } else if (str == "random") {
            const index = Math.floor(Math.random() * result.length);
            let pokemon = result[index];
            let response = await fetch(pokemon.url);
            let json = await response.json();
            spriteShiny = json.sprites.front_shiny;
            spriteNormal = json.sprites.front_default;

            table += `<tr><td>${pokemon.name}</td><td> <img src="${spriteNormal}" alt=${pokemon.name}> 
            </td><td> <img src="${spriteShiny}" alt=${pokemon.name}> </td></tr>`;
            count = count + 1;
          }

          const inquiry = {
            search: request.body.pokename,
            amount: count,
          };

          await insertSearch(client, databaseAndCollection, inquiry);

          table += "</table>";
          const variables = { pokemonTable: table };

          response.render("display", variables);
        });

        //your search history will be retrieved from mongo here in a table
        app.get("/history", async (request, response) => {
          let table = "";
          table +=
            "<table border=1><tr><th>Search Input</th><th>Results Count</th></tr>";
          let list = await getHistory(client, databaseAndCollection);

          list.forEach((element) => {
            table += `<tr><td>${element.search}</td><td>${element.amount}</td></tr>`;
          });

          table += "</table>";
          const variables = { searchTable: table };

          response.render("history", variables);
        });

        app.post("/history", async (request, response) => {
          await client.connect();
          await client
            .db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection)
            .deleteMany({});

          response.render("clearHistory");
        });
      })
      .catch((error) => {
        console.error(error);
      });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

async function insertSearch(client, databaseAndCollection, search) {
  await client.connect();
  await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .insertOne(search);
}

async function getHistory(client, databaseAndCollection) {
  await client.connect();
  let temp = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find();

  const result = await temp.toArray();
  return result;
}

main().catch(console.error);
