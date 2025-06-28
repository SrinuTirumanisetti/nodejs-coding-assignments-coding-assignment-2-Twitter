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

app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = ?;`;
  const dbUser = await db.get(selectUserQuery, [username]);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const addUserQuery = `
        INSERT INTO user (username, password, name, gender)
        VALUES (?, ?, ?, ?);`;
      await db.run(addUserQuery, [username, hashedPassword, name, gender]);

      response.status(200);
      response.send("User created successfully");
    }
  }
});
