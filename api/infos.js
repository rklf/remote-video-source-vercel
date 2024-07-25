import ffprobe from "ffprobe-static";
import { fileTypeFromStream } from "file-type";
import ffmpeg from "fluent-ffmpeg";
import fetch from "node-fetch";
import ytdl from "@distube/ytdl-core";
import probe from "probe-image-size";
import file_size_url from "./file_size_url.js";
ffmpeg.setFfprobePath(ffprobe.path);
console.log(ffprobe.path);

const allowCors = (fn) => async (req, res) => {
  Object.entries({
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
    "Access-Control-Allow-Headers":
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  }).map((value) => res.setHeader(...value));

  if (req.method === "OPTIONS") {
    return res.end();
  }
  return await fn(req, res);
};

const run = async (req, res) => {
  const { url: raw } = req.query;
  if (!raw) throw Error("[MISSING] URL");
  console.warn("decode:", decodeURIComponent(raw));

  const url = await ytdl
    .getInfo(decodeURIComponent(raw))
    .then(({ formats }) => formats)
    .then((arr) =>
      arr
        .filter(({ hasVideo, hasAudio }) => hasVideo && hasAudio)
        .sort(({ bitrate: a }, { bitrate: b }) => b - a)
        .shift()
    )
    .then((video) => (video ? video.url : raw))
    .catch((d) => console.error(d) ?? raw);

  const mime = (await fileTypeFromStream((await fetch(url)).body)).mime;
  return res.end(
    JSON.stringify({
      ...(mime.includes("image")
        ? await probe(url).then(async ({ width, height }) => ({
            width,
            height,
            size: await file_size_url(url),
          }))
        : await new Promise((res) =>
            ffmpeg.ffprobe(
              url,
              (
                err,
                { format: { size }, streams: [{ width, height, duration }] }
              ) => (err ? rej(err) : res({ width, height, duration, size }))
            )
          )),
      contentType: mime,
      name: url.split("/").pop()?.split(".")?.shift(),
      url,
    })
  );
};

export default allowCors((req, res) =>
  run(req, res).catch((error) =>
    res
      .writeHead(500)
      .end(JSON.stringify(error, Object.getOwnPropertyNames(error)))
  )
);
