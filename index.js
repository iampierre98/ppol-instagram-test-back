const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));
const CLIENT_ID = 302527272340249;
const CLIENT_SECRET = "b41098521747baae67653b54554ceb5b";
const REDIRECT_URI = "https://andres0212.github.io/instagram-test/";

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/instagram/access-token", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: req.body.code,
        grant_type: "authorization_code",
      }
    );
    console.log(response);
    const { access_token } = response.data;

    res.json({ access_token });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(3000, () => {
  console.log("Backend server listening on port 3000");
});
