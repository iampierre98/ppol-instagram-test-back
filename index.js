const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const app = express();
const { SocksProxyAgent } = require("socks-proxy-agent");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

require("dotenv").config();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
const CLOUDFLARE_ID = process.env.CLOUDFLARE_ID;
const DOWNLOAD_URL = process.env.DOWNLOAD_URL;
const PROXY_URL = process.env.PROXY_URL;

// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// const REDIRECT_URI = process.env.REDIRECT_URI;

//Authentificacion de AWS para usar S3
const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${CLOUDFLARE_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

//Para crear el nuevo link de descarga de las imagenes
const getNewUrl = async (url, username, mediaId) => {
  const response = await axios({
    url: url,
    method: "GET",
    responseType: "stream",
  });

  const filePath = `${username + mediaId}.jpg`;
  const writeStream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    response.data.pipe(writeStream);
  });

  if (await uploadImage(filePath, `${username + mediaId}.jpg`)) {
    return `${DOWNLOAD_URL}/${username + mediaId}.jpg`;
  }
};
//Subir las imagenes a nuestro servidor para enviarlas a nuestro almanecenamiento en la nube
const uploadImage = async (filePath, filename) => {
  const data = fs.readFileSync(filePath);
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: filename,
  };

  try {
    await S3.send(
      new PutObjectCommand({ ...params, Body: data, ContentType: "image/jpeg" })
    );

    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Error uploading file: ${filename}`, error);
    return false;
  }
};
app.post("/instagram/", async (req, res) => {
  const { username } = req.body;
  try {
    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }
    //el usuario puede enviar en link o solo usuario
    let usernameClean = "";
    if (username.includes("/")) {
      usernameClean = username.split(".com/")[1];
      if (usernameClean.includes("/")) {
        usernameClean = usernameClean.split("/")[0];
      }
    } else if (username.includes("@")) {
      usernameClean = username.split("@")[1];
    } else {
      usernameClean = username;
    }
    // Configuracion para usar el proxy tipo SOCKS5
    const ProxyAgent = new SocksProxyAgent(PROXY_URL);
    const response = await axios.get(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${usernameClean}`,
      {
        headers: {
          "X-Ig-App-Id": "936619743392459",
        },
        httpsAgent: ProxyAgent,
        htppAgent: ProxyAgent,
      }
    );
    const data = response.data.data.user.edge_owner_to_timeline_media.edges;
    const {
      full_name: name,
      biography,
      edge_followed_by: followers,
      profile_pic_url,
      fbid,
    } = response.data.data.user;
    let profile_url = `https://www.instagram.com/${usernameClean}/`;
    //Se crea un nuevo link de descarga para la imagen de perfil
    let img_profile_url = await new Promise(async (resolve, reject) => {
      await getNewUrl(profile_pic_url, usernameClean, fbid).then((url) => {
        resolve(url);
      });
    });
    // Se obtiene la informacion de las imagenes
    const media = data.slice(0, 6).map((item) => {
      const {
        thumbnail_resources,
        is_video,
        edge_media_to_caption,
        id: mediaId,
        shortcode,
      } = item.node;
      let imgUrl = `https://www.instagram.com/p/${shortcode}`;
      let caption = "";
      let display_url = thumbnail_resources[0].src;
      if (edge_media_to_caption.edges.length > 0) {
        caption = edge_media_to_caption.edges[0].node.text;
      }
      return { display_url, caption, is_video, mediaId, imgUrl };
    });
    //Se suben las imagenes a nuestro servidor y se crea un nuevo link de descarga
    const mediaUrl = await Promise.all(
      media.map(async (item) => {
        const display_url = await getNewUrl(
          item.display_url,
          usernameClean,
          item.mediaId
        );
        return {
          display_url,
          caption: item.caption,
          is_video: item.is_video,
          mediaId: item.mediaId,
          imgUrl: item.imgUrl,
        };
      })
    );
    const userData = {
      name,
      biography,
      followers: followers.count,
      img_profile_url,
      username,
      profile_url,
    };
    res.status(200).json({ userData, media: mediaUrl });
  } catch (error) {
    res.status(500).json({ error });
    console.error(error);
  }
});

// app.post("/instagram/access-token", async (req, res) => {
//   try {
//     console.log(req.body.code);
//     const url = "https://api.instagram.com/oauth/access_token";
//     const formData = new URLSearchParams();
//     formData.append("client_id", CLIENT_ID);
//     formData.append("client_secret", CLIENT_SECRET);
//     formData.append("grant_type", "authorization_code");
//     formData.append("redirect_uri", REDIRECT_URI);
//     formData.append("code", req.body.code);
//     const response = await axios.post(url, formData, {
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//     });
//     const { access_token } = response.data;

//     const largeTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${CLIENT_SECRET}&access_token=${access_token}`;
//     const largeTokenResponse = await axios.get(largeTokenUrl);
//     const { access_token: largeToken } = largeTokenResponse.data;
//     res.status(200).json({ access_token: largeToken });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error });
//   }
// });

app.listen(process.env.PORT || 3000, () => {
  console.log("Backend server listening on port 3000");
});
