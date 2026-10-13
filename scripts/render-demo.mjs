import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function run(file, args, cwd) {
  const result = spawnSync(file, args, { encoding: "utf8", shell: false, cwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr}`);
  return result.stdout.trim();
}

function videoInfo(file) {
  const info = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", file]));
  const value = Number(info.format.duration);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid video duration: ${file}`);
  return { ...info.streams[0], duration: value };
}

function time(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
}

export async function renderDemo([main, left, right, admin], outDir) {
  outDir = path.resolve(outDir);
  await mkdir(outDir, { recursive: true });
  const inputs = [main, left, right, admin].map(videoInfo);
  inputs.forEach((input, index) => {
    if (input.width !== (index === 1 || index === 2 ? 1280 : 2560) || input.height !== 1440)
      throw new Error("Capture must be native 2K, with 1280×1440 race windows; lower-resolution footage is rejected");
  });
  const mainTime = inputs[0].duration;
  const raceTime = Math.min(inputs[1].duration, inputs[2].duration);
  const adminTime = inputs[3].duration;
  const total = mainTime + raceTime + adminTime;
  if (total < 180 || total > 300) throw new Error(`Demo must be 3–5 minutes; footage is ${total.toFixed(2)} seconds`);
  const captions = [
    [0, mainTime, "Customer booking · Timed hold · Payment retry · Cancellation"],
    [mainTime, mainTime + raceTime, "Two independent customers · One seat · One successful hold"],
    [mainTime + raceTime, total, "Admin · Booking details · Film management · Overlap validation"],
  ].map(([start, end, label], i) => `${i + 1}\n${time(start)} --> ${time(end)}\n${label}\n`).join("\n");
  await writeFile(path.join(outDir, "captions.srt"), captions);
  const final = path.join(outDir, "frame-demo.mp4");
  run("ffmpeg", ["-y", "-i", main, "-i", left, "-i", right, "-i", admin, "-filter_complex",
    "[0:v]setsar=1,fps=30,setpts=PTS-STARTPTS,format=yuv420p[m];[1:v]setsar=1,fps=30,setpts=PTS-STARTPTS[l];[2:v]setsar=1,fps=30,setpts=PTS-STARTPTS[r];[l][r]hstack=inputs=2:shortest=1[race];[3:v]setsar=1,fps=30,setpts=PTS-STARTPTS,format=yuv420p[a];[m][race][a]concat=n=3:v=1:a=0[combined];[combined]subtitles=captions.srt:force_style='PlayResX=2560,PlayResY=1440,FontSize=30,MarginV=36,Outline=1,Shadow=0'[v]",
    "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", final], outDir);
  const result = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,pix_fmt", "-of", "json", final]));
  const stream = result.streams[0];
  if (stream.codec_name !== "h264" || stream.width !== 2560 || stream.height !== 1440 || stream.pix_fmt !== "yuv420p" || Math.abs(Number(result.format.duration) - total) > 1) throw new Error("Rendered demo failed verification");
  console.log(JSON.stringify({ file: final, ...result.format, ...stream }));
  return final;
}
