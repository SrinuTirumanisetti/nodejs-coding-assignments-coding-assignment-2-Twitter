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
      driver: sqlite3.Database,
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

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "srinutiru", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

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

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "srinutiru");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = ?;`;
  const user = await db.get(getUserIdQuery, [username]);
  const userId = user.user_id;

  const getFeedQuery = `
    SELECT 
      user.username,
      tweet.tweet,
      tweet.date_time AS dateTime
    FROM 
      follower
      INNER JOIN tweet ON follower.following_user_id = tweet.user_id
      INNER JOIN user ON user.user_id = tweet.user_id
    WHERE 
      follower.follower_user_id = ?
    ORDER BY 
      tweet.date_time DESC
    LIMIT 4;
  `;
  const feed = await db.all(getFeedQuery, [userId]);
  response.send(feed);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT * FROM user WHERE username = ?;`;
  const dbUser = await db.get(getUserIdQuery, [username]);
  const userId = dbUser.user_id;
  const getFollowingQuery = `
    SELECT 
      user.name
    FROM 
      follower
      INNER JOIN user 
      ON follower.following_user_id = user.user_id
    WHERE 
      follower.follower_user_id = ?;
  `;

  const followingList = await db.all(getFollowingQuery, [userId]);
  response.send(followingList);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserIdQuery = `SELECT * FROM user WHERE username = ?;`;
  const dbUser = await db.get(getUserIdQuery, [username]);

  const userId = dbUser.user_id;
  const getFollowersQuery = `
    SELECT 
      user.name
    FROM 
      follower
      INNER JOIN user ON follower.follower_user_id = user.user_id
    WHERE 
      follower.following_user_id = ?;
  `;

  const followersList = await db.all(getFollowersQuery, [userId]);
  response.send(followersList);
});
