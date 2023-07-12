const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));
const CLIENT_ID = "302527272340249";
const CLIENT_SECRET = "b41098521747baae67653b54554ceb5b";
const REDIRECT_URI = "https://andres0212.github.io/instagram-test/";

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/instagram/access-token", async (req, res) => {
  try {
    console.log(req.body.code);
    const url = "https://api.instagram.com/oauth/access_token";
    const formData = new URLSearchParams();
    formData.append("client_id", CLIENT_ID);
    formData.append("client_secret", CLIENT_SECRET);
    formData.append("grant_type", "authorization_code");
    formData.append("redirect_uri", REDIRECT_URI);
    formData.append("code", req.body.code);
    const response = await axios.post(url, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const { access_token } = response.data;

    res.json({ access_token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

app.listen(3000, () => {
  console.log("Backend server listening on port 3000");
});
