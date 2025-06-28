const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "twitterClone.db");

const InitializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.database,
    });
    app.listen(3000, () => {
      console.log(`server is running on http://localhost:3000`);
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};

InitializeDBAndServer();
