import ytdl from "ytdl-core";
import axios from "axios";

const allowCors = (fn) => async (req, res) => {
  Object.entries({
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
    "Access-Control-Allow-Headers":
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  }).map((value) => res.setHeader(...value));

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const run = async (req, res) => {
  const { video_id: videoId, url: videoUrl, proxy = false } = req.query;
  if (!videoId && !videoUrl) throw Error("[MISSING] VIDEO_ID OR URL");

  const url = await ytdl
    .getInfo(videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl)
    .then(({ formats }) => formats)
    .then((arr) =>
      arr
        .filter(({ hasVideo, hasAudio }) => hasVideo && hasAudio)
        .sort(({ bitrate: a }, { bitrate: b }) => b - a)
        .shift()
    )
    .then((video) => (video ? video.url : null));

  return proxy
    ? axios
        .get(url, { responseType: "stream" })
        .then((stream) =>
          stream.data.pipe(res.writeHead(stream.status, stream.headers))
        )
    : res.writeHead(301, { Location: url }).end();
};

export default allowCors((req, res) =>
  run(req, res).catch((error) =>
    res
      .writeHead(500)
      .end(JSON.stringify(error, Object.getOwnPropertyNames(error)))
  )
);
