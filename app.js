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

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "srinutiru", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const userQuery = `SELECT * FROM user WHERE username = ?`;
  const dbUser = await db.get(userQuery, [username]);

  if (dbUser) {
    response.status(400).send("User already exists");
  } else if (password.length < 6) {
    response.status(400).send("Password is too short");
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const addUserQuery = `INSERT INTO user (username, password, name, gender) VALUES (?, ?, ?, ?)`;
    await db.run(addUserQuery, [username, hashedPassword, name, gender]);
    response.status(200).send("User created successfully");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `SELECT * FROM user WHERE username = ?`;
  const dbUser = await db.get(userQuery, [username]);

  if (!dbUser) {
    response.status(400).send("Invalid user");
  } else {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValid) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "srinutiru");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const {
    user_id,
  } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [username]);
  const tweets = await db.all(
    `
    SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
    FROM follower
    JOIN tweet ON follower.following_user_id = tweet.user_id
    JOIN user ON tweet.user_id = user.user_id
    WHERE follower.follower_user_id = ?
    ORDER BY tweet.date_time DESC
    LIMIT 4
  `,
    [user_id]
  );
  response.send(tweets);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const {
    user_id,
  } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
    request.username,
  ]);
  const data = await db.all(
    `
    SELECT user.name FROM follower
    JOIN user ON follower.following_user_id = user.user_id
    WHERE follower.follower_user_id = ?
  `,
    [user_id]
  );
  response.send(data);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const {
    user_id,
  } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
    request.username,
  ]);
  const data = await db.all(
    `
    SELECT user.name FROM follower
    JOIN user ON follower.follower_user_id = user.user_id
    WHERE follower.following_user_id = ?
  `,
    [user_id]
  );
  response.send(data);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const {
    user_id,
  } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
    request.username,
  ]);
  const tweet = await db.get(
    `
    SELECT tweet.tweet, tweet.date_time AS dateTime, tweet.user_id
    FROM tweet
    WHERE tweet.tweet_id = ?
  `,
    [tweetId]
  );

  const following = await db.get(
    `
    SELECT * FROM follower WHERE follower_user_id = ? AND following_user_id = ?
  `,
    [user_id, tweet.user_id]
  );

  if (!following) return response.status(401).send("Invalid Request");

  const likes = await db.get(
    `SELECT COUNT(*) AS likes FROM like WHERE tweet_id = ?`,
    [tweetId]
  );
  const replies = await db.get(
    `SELECT COUNT(*) AS replies FROM reply WHERE tweet_id = ?`,
    [tweetId]
  );

  response.send({
    tweet: tweet.tweet,
    likes: likes.likes,
    replies: replies.replies,
    dateTime: tweet.dateTime,
  });
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const {
      user_id,
    } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
      request.username,
    ]);

    const tweet = await db.get(`SELECT * FROM tweet WHERE tweet_id = ?`, [
      tweetId,
    ]);
    const following = await db.get(
      `SELECT * FROM follower WHERE follower_user_id = ? AND following_user_id = ?`,
      [user_id, tweet.user_id]
    );
    if (!following) return response.status(401).send("Invalid Request");

    const likedUsers = await db.all(
      `
    SELECT user.username FROM like
    JOIN user ON like.user_id = user.user_id
    WHERE like.tweet_id = ?
  `,
      [tweetId]
    );

    response.send({ likes: likedUsers.map((u) => u.username) });
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const {
      user_id,
    } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
      request.username,
    ]);

    const tweet = await db.get(`SELECT * FROM tweet WHERE tweet_id = ?`, [
      tweetId,
    ]);
    const following = await db.get(
      `SELECT * FROM follower WHERE follower_user_id = ? AND following_user_id = ?`,
      [user_id, tweet.user_id]
    );
    if (!following) return response.status(401).send("Invalid Request");

    const replies = await db.all(
      `
    SELECT user.name, reply.reply FROM reply
    JOIN user ON reply.user_id = user.user_id
    WHERE reply.tweet_id = ?
  `,
      [tweetId]
    );
    response.send({ replies });
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const {
    user_id,
  } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
    request.username,
  ]);
  const tweets = await db.all(
    `
    SELECT tweet.tweet, tweet.date_time AS dateTime,
    (SELECT COUNT(*) FROM like WHERE tweet_id = tweet.tweet_id) AS likes,
    (SELECT COUNT(*) FROM reply WHERE tweet_id = tweet.tweet_id) AS replies
    FROM tweet WHERE tweet.user_id = ?
  `,
    [user_id]
  );
  response.send(tweets);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const {
    user_id,
  } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
    request.username,
  ]);
  await db.run(
    `INSERT INTO tweet (tweet, user_id, date_time) VALUES (?, ?, datetime('now'))`,
    [tweet, user_id]
  );
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const {
      user_id,
    } = await db.get(`SELECT user_id FROM user WHERE username = ?`, [
      request.username,
    ]);
    const tweet = await db.get(`SELECT * FROM tweet WHERE tweet_id = ?`, [
      tweetId,
    ]);

    if (tweet.user_id !== user_id) {
      response.status(401).send("Invalid Request");
    } else {
      await db.run(`DELETE FROM tweet WHERE tweet_id = ?`, [tweetId]);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
